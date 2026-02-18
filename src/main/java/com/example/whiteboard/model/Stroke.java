package com.example.whiteboard.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "strokes", indexes = {
    @Index(name = "idx_stroke_created_at", columnList = "createdAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Stroke {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Color as a CSS string, e.g. "#ff0000" or "rgba(255,0,0,0.8)" */
    @Column(nullable = false, length = 32)
    private String color;

    /** Brush size in pixels */
    @Column(nullable = false)
    private float lineWidth;

    /**
     * Serialized list of points as JSON string.
     * Format: [[x1,y1],[x2,y2],...]
     * Stored as TEXT for portability; use JSONB in production for indexing.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String points;

    /** Tool type: "pen", "eraser" */
    @Column(nullable = false, length = 16)
    private String tool;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }
}
