"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import ProjectCard from "./ProjectCard";

type Partner = { id: string; name: string; email: string };

type ProjectItem = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  startDate: Date;
  budget: number;
  status: string;
  partners: Partner[];
};

function SortableCard({
  project,
  companyId,
  isAdmin,
  isPartner,
  partnerUsers,
}: {
  project: ProjectItem;
  companyId: string;
  isAdmin: boolean;
  isPartner: boolean;
  partnerUsers: Partner[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        position: "relative",
      }}
    >
      {/* Drag handle — only shown to admins */}
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 w-6 h-6 flex items-center justify-center rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
          style={{ color: "#8b949e" }}
          title="Drag to reorder"
        >
          ⠿
        </div>
      )}
      <ProjectCard
        project={project}
        companyId={companyId}
        isAdmin={isAdmin}
        isPartner={isPartner}
        partnerUsers={partnerUsers}
      />
    </div>
  );
}

export default function ProjectsGrid({
  initialProjects,
  companyId,
  isAdmin,
  isPartner,
  partnerUsers,
}: {
  initialProjects: ProjectItem[];
  companyId: string;
  isAdmin: boolean;
  isPartner: boolean;
  partnerUsers: Partner[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setProjects((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });

      // Persist — fire-and-forget (optimistic)
      setProjects((prev) => {
        fetch(`/api/${companyId}/projects/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: prev.map((p) => p.id) }),
        }).catch(() => {});
        return prev;
      });
    },
    [companyId]
  );

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={projects.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {projects.map((p) => (
            <div key={p.id} className="group">
              <SortableCard
                project={p}
                companyId={companyId}
                isAdmin={isAdmin}
                isPartner={isPartner}
                partnerUsers={partnerUsers}
              />
            </div>
          ))}

          {isAdmin && (
            <Link
              href={`/${companyId}/projects/new`}
              className="flex flex-col items-center justify-center rounded-2xl py-10 px-10 text-center transition-all hover:border-[#C9A84C88]"
              style={{ background: "#0d1117", border: "1px dashed #C9A84C66", minHeight: "220px" }}
            >
              <div className="text-6xl font-bold leading-none mb-4" style={{ color: "#C9A84C55" }}>+</div>
              <div className="text-xl font-semibold" style={{ color: "#C9A84C88" }}>New Project</div>
            </Link>
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeProject && (
          <div style={{ opacity: 0.9, transform: "rotate(2deg)" }}>
            <ProjectCard
              project={activeProject}
              companyId={companyId}
              isAdmin={isAdmin}
              isPartner={isPartner}
              partnerUsers={partnerUsers}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
