package com.lvo.crm.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Charge {@code backend/.env} (ou {@code .env}) avant le démarrage Spring pour alimenter
 * les placeholders {@code ${ONEDRIVE_ENABLED}} / {@code ${AZURE_*}} de {@code application.yml}.
 */
public final class DotenvLoader {

    private static final Logger log = LoggerFactory.getLogger(DotenvLoader.class);

    private DotenvLoader() {}

    public static void loadIfPresent() {
        for (Path path : candidatePaths()) {
            if (Files.isRegularFile(path)) {
                loadFile(path);
                return;
            }
        }
    }

    private static List<Path> candidatePaths() {
        String override = System.getProperty("lvo.env.file");
        if (override != null && !override.isBlank()) {
            return List.of(Path.of(override));
        }
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        List<Path> paths = new ArrayList<>();
        if ("backend".equals(cwd.getFileName().toString())) {
            paths.add(cwd.resolve(".env"));
        } else {
            paths.add(cwd.resolve("backend").resolve(".env"));
            paths.add(cwd.resolve(".env"));
        }
        return paths;
    }

    private static void loadFile(Path file) {
        int loaded = 0;
        try {
            for (String line : Files.readAllLines(file)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int eq = trimmed.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = trimmed.substring(0, eq).trim();
                String value = trimmed.substring(eq + 1).trim();
                if ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length() - 1);
                }
                if (key.isEmpty()) {
                    continue;
                }
                if (System.getenv(key) != null) {
                    continue;
                }
                if (System.getProperty(key) != null) {
                    continue;
                }
                System.setProperty(key, value);
                loaded++;
            }
            log.info("Variables chargées depuis {} ({} entrée(s))", file.toAbsolutePath(), loaded);
        } catch (IOException e) {
            log.warn("Impossible de lire {} : {}", file, e.getMessage());
        }
    }
}
