package com.aza.backend.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonGenerator;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.deser.std.StdDeserializer;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.ser.std.StdSerializer;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Serializes LocalDateTime as a UTC instant ("2026-06-11T14:03:22Z") instead of
 * a zoneless local string. Clients across mobile/admin/merchant parse timestamps
 * with {@code new Date(iso)}, which interprets zoneless strings as the device's
 * local time — skewing "last seen" and every other timestamp for anyone not in
 * the server's timezone. Entity LocalDateTimes are produced in the server zone
 * (LocalDateTime.now() / Hibernate timestamps), so converting via the system
 * zone is correct regardless of where the server runs.
 *
 * Deserialization is lenient: accepts both offset forms ("...Z", "+01:00") and
 * legacy zoneless strings from older clients.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer utcLocalDateTimeCustomizer() {
        return builder -> builder.addModule(new SimpleModule("aza-utc-localdatetime")
                .addSerializer(LocalDateTime.class, new UtcLocalDateTimeSerializer())
                .addDeserializer(LocalDateTime.class, new LenientLocalDateTimeDeserializer()));
    }

    static final class UtcLocalDateTimeSerializer extends StdSerializer<LocalDateTime> {
        UtcLocalDateTimeSerializer() {
            super(LocalDateTime.class);
        }

        @Override
        public void serialize(LocalDateTime value, JsonGenerator gen, SerializationContext ctxt) {
            gen.writeString(value.atZone(ZoneId.systemDefault()).toInstant().toString());
        }
    }

    static final class LenientLocalDateTimeDeserializer extends StdDeserializer<LocalDateTime> {
        LenientLocalDateTimeDeserializer() {
            super(LocalDateTime.class);
        }

        @Override
        public LocalDateTime deserialize(JsonParser parser, DeserializationContext ctxt) {
            String text = parser.getString();
            if (text == null || text.isBlank()) return null;
            try {
                // Offset-aware ("Z" or "+01:00") — convert into the server zone.
                return OffsetDateTime.parse(text)
                        .atZoneSameInstant(ZoneId.systemDefault())
                        .toLocalDateTime();
            } catch (Exception e) {
                // Zoneless legacy form — take it at face value.
                return LocalDateTime.parse(text);
            }
        }
    }
}
