package com.lvo.crm;

import com.lvo.crm.config.DotenvLoader;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LvoCrmApplication {

    public static void main(String[] args) {
        DotenvLoader.loadIfPresent();
        SpringApplication.run(LvoCrmApplication.class, args);
    }
}
