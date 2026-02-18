package com.example.whiteboard.service;

import com.example.whiteboard.model.Stroke;
import com.example.whiteboard.model.StrokeDTO;
import com.example.whiteboard.repository.StrokeRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StrokeService {

    private final StrokeRepository strokeRepository;
    private final ObjectMapper objectMapper;

    /**
     * Persists a stroke asynchronously so it never blocks the WebSocket broadcast thread.
     * Uses @Transactional to ensure atomicity — if the DB write fails, no partial data is saved.
     */
    @Async
    @Transactional
    public void persistStroke(StrokeDTO dto) {
        try {
            String pointsJson = objectMapper.writeValueAsString(dto.getPoints());
            Stroke stroke = Stroke.builder()
                    .color(dto.getColor())
                    .lineWidth(dto.getLineWidth())
                    .points(pointsJson)
                    .tool(dto.getTool() != null ? dto.getTool() : "pen")
                    .build();
            strokeRepository.save(stroke);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize stroke points: {}", e.getMessage());
        }
    }

    /**
     * Returns all strokes ordered by creation time for history replay.
     * New users call this on connect to catch up with the board state.
     */
    @Transactional(readOnly = true)
    public List<StrokeDTO> getAllStrokes() {
        return strokeRepository.findAllByOrderByCreatedAtAsc()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Clears all strokes from the database.
     */
    @Transactional
    public void clearBoard() {
        strokeRepository.deleteAll();
    }

    private StrokeDTO toDTO(Stroke stroke) {
        try {
            List<double[]> points = objectMapper.readValue(
                    stroke.getPoints(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, double[].class)
            );
            return StrokeDTO.builder()
                    .color(stroke.getColor())
                    .lineWidth(stroke.getLineWidth())
                    .points(points)
                    .tool(stroke.getTool())
                    .build();
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize stroke {}: {}", stroke.getId(), e.getMessage());
            return StrokeDTO.builder()
                    .color(stroke.getColor())
                    .lineWidth(stroke.getLineWidth())
                    .points(Collections.emptyList())
                    .tool(stroke.getTool())
                    .build();
        }
    }
}
