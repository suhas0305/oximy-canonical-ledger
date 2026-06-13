export const CANONICAL_ACTIVITY_TYPES = [
  {
    type: "conversation",
    label: "Conversation",
    description: "Multi-turn chat or assistant interaction."
  },
  {
    type: "completion",
    label: "Completion",
    description: "Single request/response generation through an API or app."
  },
  {
    type: "code_assist",
    label: "Code Assist",
    description: "Coding, refactoring, terminal, IDE, or CLI assistance."
  },
  {
    type: "image_generation",
    label: "Image Generation",
    description: "Text-to-image, image editing, or creative asset generation."
  },
  {
    type: "embedding",
    label: "Embedding",
    description: "Vectorization for retrieval, clustering, search, or memory."
  },
  {
    type: "retrieval_search",
    label: "Retrieval/Search",
    description: "AI-assisted search, RAG retrieval, or corpus lookup."
  },
  {
    type: "agent_tool_call",
    label: "Agent Tool Call",
    description: "Autonomous agent action that calls a tool, API, shell, or workflow."
  },
  {
    type: "document_analysis",
    label: "Document Analysis",
    description: "Summarization, extraction, classification, or review of files."
  },
  {
    type: "transcription",
    label: "Transcription",
    description: "Speech-to-text, meeting notes, or audio/video understanding."
  }
];

export function canonicalActivityTypeSet() {
  return new Set(CANONICAL_ACTIVITY_TYPES.map((entry) => entry.type));
}
