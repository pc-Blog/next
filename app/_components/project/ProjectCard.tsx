import Link from "next/link";
import type { ProjectVO } from "@/lib/types";
import { assetUrl } from "@/lib/asset-url";

export default function ProjectCard({ project }: { project: ProjectVO }) {
  return (
    <Link href={`/project/${project.id}`} className="block group">
      <article className="glass-card overflow-hidden h-full flex flex-col">
        {project.coverImage && (
          <div className="relative h-44 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(project.coverImage)}
              alt={project.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}
        <div className="flex-1 p-5 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {project.name}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">
            {project.summary}
          </p>
          {project.techs && project.techs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.techs.map((tech) => (
                <span key={tech.id} className="px-2 py-0.5 text-[10px] rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                  {tech.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
