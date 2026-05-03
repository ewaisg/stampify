// Zoom controls
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_INCREMENT = 0.2;

// Stamp sizing
export const MIN_STAMP_SIZE = 12;

// Export settings
export const EXPORT_PIXEL_RATIO = 4;

// File size limits
export const MAX_FILE_SIZE_MB = 10; // PDF
export const MAX_IMAGE_SIZE_MB = 2;

// Supported image types
export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
] as const;

// History
export const UNDO_STACK_SIZE = 20;
