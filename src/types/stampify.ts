// ---------------------------------------------------------------------------
// Stamp Templates & Blend Modes
// ---------------------------------------------------------------------------

export type StampTemplate =
  | "text"
  | "text_with_border"
  | "text_with_date_and_border"
  | "text_with_rounded_border";

export type BlendMode = "normal" | "overlay";

// ---------------------------------------------------------------------------
// Concrete Stamp Types
// ---------------------------------------------------------------------------

export interface TextStamp {
  id: string;
  type: "text";
  name: string;
  text: string;
  author: string;
  template: StampTemplate;
  width: number;
  height: number;
  blendMode: BlendMode;
  /** 0 – 100 */
  opacity: number;
  /** Degrees, 0 – 360 */
  rotation: number;
  fontColor: string;
  lineColor: string;
  fontSize: number;
}

export interface ImageStamp {
  id: string;
  type: "image";
  name: string;
  /** Firebase Storage URL */
  storageUrl: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Dynamic Field Types
// ---------------------------------------------------------------------------

export type DynamicFieldType = "staticText" | "textField" | "date" | "image";

export interface BaseField {
  id: string;
  type: DynamicFieldType;
  label: string;
}

export interface StaticTextField extends BaseField {
  type: "staticText";
  value: string;
}

export interface TextField extends BaseField {
  type: "textField";
  placeholder?: string;
}

export interface DateField extends BaseField {
  type: "date";
  format?: string;
}

export interface ImageField extends BaseField {
  type: "image";
  storageUrl?: string;
}

export type DynamicField = StaticTextField | TextField | DateField | ImageField;

// ---------------------------------------------------------------------------
// Dynamic & Prepared Stamps
// ---------------------------------------------------------------------------

export interface DynamicStamp {
  id: string;
  type: "dynamic";
  name: string;
  width: number;
  height: number;
  fields: DynamicField[];
  backgroundColor: string;
}

export interface PreparedStamp {
  id: string;
  type: "prepared";
  name: string;
  templateId: string;
  width: number;
  height: number;
  fields: DynamicField[];
  backgroundColor: string;
  data: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Stamp Union
// ---------------------------------------------------------------------------

export type Stamp = TextStamp | ImageStamp | DynamicStamp | PreparedStamp;

// ---------------------------------------------------------------------------
// NewStamp Creation Types (id omitted)
// ---------------------------------------------------------------------------

export type NewTextStamp = Omit<TextStamp, "id">;
export type NewImageStamp = Omit<ImageStamp, "id">;
export type NewDynamicStamp = Omit<DynamicStamp, "id">;
export type NewPreparedStamp = Omit<PreparedStamp, "id">;
export type NewStamp =
  | NewTextStamp
  | NewImageStamp
  | NewDynamicStamp
  | NewPreparedStamp;

// ---------------------------------------------------------------------------
// Applied Stamps
// ---------------------------------------------------------------------------

export interface AppliedStamp {
  id: string;
  stampId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  baseWidth: number;
  baseHeight: number;
  rotation: number;
  data?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// File Metadata
// ---------------------------------------------------------------------------

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  storageUrl: string;
  uploadedAt: Date;
  userId: string;
}

// ---------------------------------------------------------------------------
// AI Provider Configuration
// ---------------------------------------------------------------------------

export type AIProviderType = "azure" | "openai" | "anthropic";

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey: string;
  /** Required for Azure provider */
  endpoint?: string;
  model: string;
  isDefault: boolean;
}

export interface UserAISettings {
  providers: AIProviderConfig[];
  activeProvider: AIProviderType | null;
}

// ---------------------------------------------------------------------------
// User Settings
// ---------------------------------------------------------------------------

export interface UserSettings {
  ai: UserAISettings;
  theme: "light" | "dark" | "system";
}
