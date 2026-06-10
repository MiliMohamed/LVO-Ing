package com.lvo.crm.api;

import com.lvo.crm.api.dto.ChangePasswordRequest;
import com.lvo.crm.api.dto.UpdateProfileRequest;
import com.lvo.crm.api.dto.UserProfileDto;
import com.lvo.crm.service.UserProfileService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
public class UserProfileController {

    private final UserProfileService profileService;

    public UserProfileController(UserProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public UserProfileDto profile() {
        return profileService.getProfile();
    }

    @PatchMapping("/profile")
    public UserProfileDto updateProfile(@RequestBody @Valid UpdateProfileRequest request) {
        return profileService.updateProfile(request);
    }

    @PostMapping("/password")
    public Map<String, String> changePassword(@RequestBody @Valid ChangePasswordRequest request) {
        profileService.changePassword(request);
        return Map.of("status", "ok", "message", "Mot de passe mis à jour");
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserProfileDto uploadAvatar(@RequestParam("file") MultipartFile file) throws IOException {
        return profileService.saveAvatar(file);
    }

    @DeleteMapping("/avatar")
    public UserProfileDto removeAvatar() throws IOException {
        return profileService.removeAvatar();
    }

    @GetMapping("/avatar")
    public ResponseEntity<byte[]> avatar() throws IOException {
        UserProfileService.AvatarPayload payload = profileService.loadAvatar();
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .contentType(MediaType.parseMediaType(payload.contentType()))
                .body(payload.bytes());
    }
}
