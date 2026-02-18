package com.example.whiteboard.repository;

import com.example.whiteboard.model.Stroke;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StrokeRepository extends JpaRepository<Stroke, Long> {

    /** Fetch all strokes ordered by creation time for history replay */
    List<Stroke> findAllByOrderByCreatedAtAsc();

    /** Delete all strokes (board clear) */
    void deleteAll();
}
