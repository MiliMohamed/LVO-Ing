package com.lvo.crm.onedrive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lvo.crm.config.OneDriveProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class MicrosoftGraphClient {

    private static final String GRAPH = "https://graph.microsoft.com/v1.0";

    private final OneDriveProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();

    public MicrosoftGraphClient(OneDriveProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    }

    public DriveItemRef createFolder(String parentId, String name) {
        String body =
                """
                {
                  "name": %s,
                  "folder": {},
                  "@microsoft.graph.conflictBehavior": "rename"
                }
                """
                        .formatted(objectMapper.valueToTree(name).toString());
        JsonNode json = postJson(driveChildrenUrl(parentId), body);
        return toRef(json);
    }

    public DriveItemRef getItemByPath(String pathFromRoot) {
        String encoded = encodePath(pathFromRoot);
        String url = GRAPH + "/users/" + urlUser() + "/drive/root:" + encoded;
        JsonNode json = getJson(url);
        return toRef(json);
    }

    public DriveItemRef getOrCreateFolderByPath(String pathFromRoot) {
        try {
            return getItemByPath(pathFromRoot);
        } catch (OneDriveNotFoundException e) {
            return createFolderPath(pathFromRoot);
        }
    }

    private DriveItemRef createFolderPath(String pathFromRoot) {
        String normalized = pathFromRoot.startsWith("/") ? pathFromRoot.substring(1) : pathFromRoot;
        String[] segments = normalized.split("/");
        String parentId = "root";
        DriveItemRef last = null;
        StringBuilder built = new StringBuilder();
        for (String segment : segments) {
            if (segment.isBlank()) continue;
            if (!built.isEmpty()) built.append('/');
            built.append(segment);
            String currentPath = "/" + built;
            try {
                last = getItemByPath(currentPath);
                parentId = last.id();
            } catch (OneDriveNotFoundException e) {
                last = createFolder(parentId, segment);
                parentId = last.id();
            }
        }
        if (last == null) {
            throw new IllegalArgumentException("Chemin OneDrive vide");
        }
        return last;
    }

    private String driveChildrenUrl(String parentId) {
        if ("root".equals(parentId)) {
            return GRAPH + "/users/" + urlUser() + "/drive/root/children";
        }
        return GRAPH + "/users/" + urlUser() + "/drive/items/" + parentId + "/children";
    }

    private String urlUser() {
        return URLEncoder.encode(properties.getUserPrincipalName(), StandardCharsets.UTF_8);
    }

    private static String encodePath(String pathFromRoot) {
        String p = pathFromRoot.startsWith("/") ? pathFromRoot : "/" + pathFromRoot;
        return p.replace("'", "''");
    }

    private String accessToken() {
        String key = properties.getTenantId() + "|" + properties.getClientId();
        CachedToken cached = tokenCache.get(key);
        if (cached != null && cached.expiresAt.isAfter(Instant.now().plusSeconds(60))) {
            return cached.value;
        }
        String tokenUrl =
                "https://login.microsoftonline.com/" + properties.getTenantId() + "/oauth2/v2.0/token";
        String form =
                "client_id="
                        + urlEncode(properties.getClientId())
                        + "&client_secret="
                        + urlEncode(properties.getClientSecret())
                        + "&scope="
                        + urlEncode("https://graph.microsoft.com/.default")
                        + "&grant_type=client_credentials";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tokenUrl))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Échec OAuth Microsoft (HTTP " + response.statusCode() + ")");
            }
            JsonNode json = objectMapper.readTree(response.body());
            String token = json.path("access_token").asText(null);
            int expiresIn = json.path("expires_in").asInt(3600);
            if (token == null || token.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Token Microsoft Graph absent");
            }
            tokenCache.put(key, new CachedToken(token, Instant.now().plusSeconds(expiresIn)));
            return token;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Impossible d'obtenir un token Microsoft Graph", e);
        }
    }

    private JsonNode getJson(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + accessToken())
                    .GET()
                    .build();
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 404) {
                throw new OneDriveNotFoundException(url);
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw graphError(response.statusCode(), response.body());
            }
            return objectMapper.readTree(response.body());
        } catch (OneDriveNotFoundException | ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Erreur appel Microsoft Graph", e);
        }
    }

    private JsonNode postJson(String url, String body) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + accessToken())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw graphError(response.statusCode(), response.body());
            }
            return objectMapper.readTree(response.body());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Erreur création dossier OneDrive", e);
        }
    }

    private static ResponseStatusException graphError(int status, String body) {
        return new ResponseStatusException(
                HttpStatus.BAD_GATEWAY, "Microsoft Graph HTTP " + status + " — " + truncate(body, 400));
    }

    private static DriveItemRef toRef(JsonNode json) {
        String id = json.path("id").asText(null);
        String webUrl = json.path("webUrl").asText(null);
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Réponse Graph sans id de dossier");
        }
        return new DriveItemRef(id, webUrl);
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    private record CachedToken(String value, Instant expiresAt) {}

    static final class OneDriveNotFoundException extends RuntimeException {
        OneDriveNotFoundException(String url) {
            super(url);
        }
    }
}
