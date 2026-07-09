# File Preview

## Purpose

File preview lets users inspect selected indexed files without leaving the workspace shell.

## Behavior

- Selecting an indexed file loads preview content through a safe Tauri command.
- Text files render in a polished code preview frame with a safe-read status.
- Loading, binary, too-large, outside-repository, and unavailable states render as designed preview states with icon badges, headings, and explanatory copy.
- File metadata remains visible with size, extension, and modified time.
- Indexed file browsing preserves search, extension filtering, selected row state, file size, and file type metadata.

## Safety Boundaries

- The preview command canonicalizes repository and file paths.
- Resolved paths must remain inside the selected repository.
- Preview size limits are enforced before content is returned.
- Binary and invalid UTF-8 content is not rendered as text.
- The UI does not expose arbitrary filesystem access.

## Design Treatment

The preview panel follows the warm premium dashboard system:

- Three clear zones: searchable file browser, selected-file detail header, and preview content area.
- White card surfaces, subtle borders, large radius, and soft dashboard shadows.
- Intentional selected-file rows with file icon, file name, path, extension, and size metadata.
- Pale nested metadata surfaces for size, type, repository, and modified time.
- Deep navy code preview frame with toolbar, readable monospace text, padding, and controlled scrolling.
- Calm preview-state surfaces for loading, binary, too-large, outside-repository, and unavailable/error states.
