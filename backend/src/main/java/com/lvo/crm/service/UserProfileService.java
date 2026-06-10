package com.lvo.crm.service;

import com.lvo.crm.api.dto.ChangePasswordRequest;
import com.lvo.crm.api.dto.UpdateProfileRequest;
import com.lvo.crm.api.dto.UserProfileDto;
import com.lvo.crm.domain.AppUser;
import com.lvo.crm.repo.AppUserRepository;
import com.lvo.crm.security.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;

@Service
public class UserProfileService {

    private static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;
    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final AppUserRepository users;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;
    private final Path avatarDir;

    public UserProfileService(
            AppUserRepository users,
            CurrentUserService currentUserService,
            PasswordEncoder passwordEncoder) {
        this.users = users;
        this.currentUserService = currentUserService;
        this.passwordEncoder = passwordEncoder;
        this.avatarDir = Path.of("backend", "uploads", "avatars");
    }

    @Transactional(readOnly = true)
    public UserProfileDto getProfile() {
        return toDto(currentUserService.requireCurrentUser());
    }

    @Transactional
    public UserProfileDto updateProfile(UpdateProfileRequest request) {
        AppUser user = currentUserService.requireCurrentUser();
        if (request.prenom() != null) {
            user.setPrenom(blankToNull(request.prenom()));
        }
        if (request.nom() != null) {
            user.setNom(blankToNull(request.nom()));
        }
        if (request.telephone() != null) {
            user.setTelephone(blankToNull(request.telephone()));
        }
        return toDto(users.save(user));
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        AppUser user = currentUserService.requireCurrentUser();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mot de passe actuel incorrect");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Le nouveau mot de passe doit être différent de l'actuel");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        users.save(user);
    }

    @Transactional
    public UserProfileDto saveAvatar(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier image requis");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image trop volumineuse (max 2 Mo)");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Format non supporté (JPEG, PNG, WebP ou GIF uniquement)");
        }

        AppUser user = currentUserService.requireCurrentUser();
        Files.createDirectories(avatarDir);
        deleteAvatarFile(user.getAvatarPath());

        String ext = extensionForContentType(contentType);
        String storedName = "user-" + user.getId() + ext;
        Path target = avatarDir.resolve(storedName);
        Files.write(target, file.getBytes());

        user.setAvatarPath(storedName);
        return toDto(users.save(user));
    }

    @Transactional(readOnly = true)
    public AvatarPayload loadAvatar() throws IOException {
        AppUser user = currentUserService.requireCurrentUser();
        String path = user.getAvatarPath();
        if (path == null || path.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucune photo de profil");
        }
        Path file = avatarDir.resolve(path).normalize();
        if (!file.startsWith(avatarDir.normalize()) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo introuvable");
        }
        byte[] bytes = Files.readAllBytes(file);
        String mediaType = mediaTypeForPath(path);
        return new AvatarPayload(bytes, mediaType);
    }

    @Transactional
    public UserProfileDto removeAvatar() throws IOException {
        AppUser user = currentUserService.requireCurrentUser();
        deleteAvatarFile(user.getAvatarPath());
        user.setAvatarPath(null);
        return toDto(users.save(user));
    }

    private void deleteAvatarFile(String storedName) throws IOException {
        if (storedName == null || storedName.isBlank()) return;
        Path file = avatarDir.resolve(storedName).normalize();
        if (file.startsWith(avatarDir.normalize()) && Files.isRegularFile(file)) {
            Files.delete(file);
        }
    }

    private UserProfileDto toDto(AppUser user) {
        Long agenceId = user.getAgence() != null ? user.getAgence().getId() : null;
        String agenceNom = user.getAgence() != null ? user.getAgence().getNom() : null;
        return new UserProfileDto(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                user.getPrenom(),
                user.getNom(),
                user.getTelephone(),
                user.getAvatarPath() != null && !user.getAvatarPath().isBlank(),
                agenceId,
                agenceNom);
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String extensionForContentType(String contentType) {
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
    }

    private static String mediaTypeForPath(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG_VALUE;
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF_VALUE;
        return MediaType.IMAGE_JPEG_VALUE;
    }

    public record AvatarPayload(byte[] bytes, String contentType) {}
}
