import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProjectSubProjectSelector({
  projects = [],
  subProjects = [],
  projectId,
  subProjectId,
  onProjectChange,
  onSubProjectChange,
  projectLabel = 'Project *',
  subProjectLabel = 'Sub Project *',
  className = '',
  children,
}) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 sm:items-end ${className}`}>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">{projectLabel}</Label>
        <Select value={projectId || undefined} onValueChange={onProjectChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">{subProjectLabel}</Label>
        <Select
          value={subProjectId || undefined}
          onValueChange={onSubProjectChange}
          disabled={!projectId}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={projectId ? 'Select sub-project' : 'Select project first'} />
          </SelectTrigger>
          <SelectContent>
            {subProjects.map((sp) => (
              <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {children}
    </div>
  );
}
