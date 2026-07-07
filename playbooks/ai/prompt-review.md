# Prompt Review Playbook

## Purpose

This playbook defines how prompts, agent instructions, and AI workflow instructions should be reviewed.

Prompts are product behavior. They should be versioned, reviewed, and improved with the same seriousness as code and specs.

## Review Inputs

Gather:

- Prompt or agent definition.
- Intended workflow.
- Required inputs.
- Expected outputs.
- Tool permissions.
- Provider assumptions.
- Safety requirements.
- Evaluation examples where available.

## Review Checklist

### 1. Purpose

Check:

- Is the prompt’s job clear?
- Is the user or workflow goal explicit?
- Is the expected output defined?

### 2. Scope

Check:

- Does the prompt stay within workflow boundaries?
- Does it avoid asking the model to perform unapproved actions?
- Does it define stop conditions?

### 3. Context Use

Check:

- Does it use context packages?
- Does it distinguish facts from inference?
- Does it ask for citations or source references where needed?
- Does it avoid unnecessary sensitive context?

### 4. Output Quality

Check:

- Is the output structured?
- Is it reviewable?
- Does it include assumptions?
- Does it include risks?
- Does it include validation recommendations?

### 5. Safety And Approval

Check:

- Does the prompt respect human approval?
- Does it avoid destructive actions?
- Does it surface external side effects?
- Does it pause when scope expands?

### 6. Provider Independence

Check:

- Does the prompt avoid provider-specific assumptions?
- Does it work through the provider abstraction?
- Does it avoid referencing OMP as the product?

### 7. Evaluation

Check:

- Are success criteria defined?
- Are failure modes known?
- Are sample inputs and outputs available?
- Can the prompt be tested against regression cases?

## Review Output

Prompt review should produce:

- Approval or revision request.
- Identified risks.
- Required edits.
- Evaluation gaps.
- Documentation follow-up.

## Success Criteria

A prompt is ready when:

- Purpose and scope are clear.
- Output is structured and reviewable.
- Approval boundaries are respected.
- Provider coupling is avoided.
- Risks and uncertainty are surfaced.
