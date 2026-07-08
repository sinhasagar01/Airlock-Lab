# File Preview

## Purpose

File preview lets users inspect selected indexed files without leaving the workspace shell.

## Behavior

- Selecting an indexed file loads preview content through a safe Tauri command.
- Text files render in a dark code preview panel.
- Loading, binary, too-large, outside-repository, and unavailable states render as explicit preview states.
- File metadata remains visible with size, extension, and modified time.

## Safety Boundaries

- The preview command canonicalizes repository and file paths.
- Resolved paths must remain inside the selected repository.
- Preview size limits are enforced before content is returned.
- Binary and invalid UTF-8 content is not rendered as text.
- The UI does not expose arbitrary filesystem access.

## Design Treatment

The preview panel follows the warm premium dashboard system:

- Pale nested metadata surfaces.
- Deep navy code preview surface.
- Warm bordered state messages.
- Stable selected-file detail layout.
