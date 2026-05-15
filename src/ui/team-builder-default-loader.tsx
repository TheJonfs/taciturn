// TeamBuilderDefaultLoader — the "Load Default" affordance (plan
// decision 13). A dropdown of the bundled team templates; picking one
// replaces the current draft. If the draft has been touched (any unit
// has a class), a confirm guards the overwrite; an untouched draft
// loads straight away.

import { useState, type CSSProperties, type ReactElement } from 'react';
import { defaultTeamTemplates } from '@content/teams/index.ts';
import type { TeamBuilder } from './use-team-builder.ts';

export interface TeamBuilderDefaultLoaderProps {
  readonly builder: TeamBuilder;
}

export function TeamBuilderDefaultLoader({
  builder,
}: TeamBuilderDefaultLoaderProps): ReactElement {
  // The select is a momentary action trigger, not persistent state — it
  // snaps back to the placeholder after each load.
  const [value, setValue] = useState('');

  const isTouched = builder.state.units.some((unit) => unit.classId !== null);

  const handleChange = (templateId: string): void => {
    setValue('');
    if (templateId === '') return;
    const template = defaultTeamTemplates.find((t) => t.id === templateId);
    if (template === undefined) return;
    if (
      isTouched &&
      !window.confirm('Load this template? Your current team will be replaced.')
    ) {
      return;
    }
    builder.loadTemplate(template.team);
  };

  return (
    <select
      style={selectStyle}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
    >
      <option value="">Load Default…</option>
      {defaultTeamTemplates.map((template) => (
        <option key={template.id} value={template.id}>
          {template.team.name}
        </option>
      ))}
    </select>
  );
}

// ---- styles ----

const selectStyle: CSSProperties = {
  padding: '7px 10px',
  fontSize: 13,
  background: '#1c1e23',
  color: '#e7e9ee',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 5,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
