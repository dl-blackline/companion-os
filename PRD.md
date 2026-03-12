# Companion OS - Product Requirements Document

A premium, deeply customizable personal AI companion platform that serves as a unified operating system for thinking, planning, deciding, creating, researching, organizing, and executing.

**Experience Qualities**:
1. **Professional yet Personal** - Combines enterprise-grade functionality with warm, human-centered companionship that feels genuinely helpful and context-aware
2. **Power-user Optimized** - Every interaction is keyboard-friendly, deeply customizable, and built for speed with shortcuts, command palette, and modular workflows
3. **Intelligent and Persistent** - The system remembers context, surfaces insights proactively, and evolves with the user through layered memory and continuous personalization

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a sophisticated personal AI platform with multiple interconnected modules: conversational AI, memory systems, knowledge management, goal tracking, customizable personas, prompt engineering tools, and extensible agent architecture. It requires advanced state management, modular architecture, and scalable patterns to support deep customization and future extensibility.

## Essential Features

### 1. Conversational AI Hub
- **Functionality**: Premium chat interface with streaming responses, multiple specialist modes (Strategist, Operator, Researcher, Coach, Creative, Neutral, Custom), conversation management with search/filter/archive
- **Purpose**: Serves as the primary interaction point where users engage with their AI companion for any task or conversation
- **Trigger**: User navigates to Chat section or uses quick action from any screen
- **Progression**: Select or create conversation → Choose mode/persona → Type message → Receive streaming response → Continue dialogue → Organize/archive conversation
- **Success criteria**: Messages stream smoothly, mode switching is instant, conversation history is searchable, chat feels responsive and premium

### 2. Deep Personalization Layer
- **Functionality**: Comprehensive settings for AI name, personality, tone, communication style, verbosity, response formats, values, planning frameworks, writing styles with live preview examples
- **Purpose**: Allows users to shape their AI companion to match their exact preferences and working style
- **Trigger**: User accesses Settings → Personalization or creates custom persona
- **Progression**: Browse personalization options → Adjust settings with live preview → Save custom persona → Apply globally or per-conversation → Test behavior changes
- **Success criteria**: Changes apply instantly, live previews accurately reflect personality shifts, custom personas save reliably, users can toggle between styles seamlessly

### 3. Memory System
- **Functionality**: Layered memory architecture (Identity, Relationship, Project, Knowledge, Episodic, Session) with inspection, editing, merging, deletion, import/export, confidence scoring, and retention controls
- **Purpose**: Creates persistent, context-aware intelligence that remembers what matters and evolves with the user
- **Trigger**: Automatic capture during conversations or manual entry in Memory Console
- **Progression**: AI detects important information → Request approval if enabled → Save to appropriate memory layer → Display in Memory Console → User reviews/edits/organizes → AI references in future interactions
- **Success criteria**: Memories persist across sessions, categorization is accurate, retrieval is fast, editing is intuitive, export works reliably

### 4. Personal Knowledge Vault
- **Functionality**: Searchable repository for documents, notes, PDFs, links, text snippets with categories, tags, collections, AI-powered summarization, and source citation
- **Purpose**: Centralizes personal knowledge so the AI can reference user's own information when responding
- **Trigger**: User uploads document, saves note, or captures web content
- **Progression**: Add content → Auto-categorize or manual tagging → AI indexes content → User asks question → AI searches vault → Cites sources in response → User can "Brief me" on any item
- **Success criteria**: Upload works smoothly, search is fast and accurate, citations are clear, AI correctly references stored knowledge

### 5. Goals, Planning, and Execution
- **Functionality**: Multi-timeframe goals dashboard (yearly/quarterly/monthly/weekly/daily), AI-assisted decomposition, task prioritization, planning workspaces, decision support, meeting prep, habit tracking, personal KPIs
- **Purpose**: Transforms high-level aspirations into actionable execution plans with AI guidance
- **Trigger**: User creates goal, plans day/week, or requests decision support
- **Progression**: Set goal → AI decomposes into milestones/tasks → Prioritize by impact/urgency/effort → Daily/weekly planning → Execute → Review progress → AI surfaces insights
- **Success criteria**: Goals break down logically, prioritization is helpful, planning feels streamlined, progress tracking is clear, AI insights are actionable

### 6. Companion Intelligence Features
- **Functionality**: Proactive reminders, follow-up suggestions, open loop detection, commitment tracking, insight cards, pattern recognition, intelligent check-ins
- **Purpose**: Makes the AI feel genuinely intelligent and helpful by surfacing what matters without being asked
- **Trigger**: Time-based (daily check-in) or event-based (goal progress, stalled project)
- **Progression**: AI analyzes context → Identifies insight → Surfaces card on dashboard → User engages or dismisses → AI learns from feedback
- **Success criteria**: Insights are relevant and timely, false positives are minimal, suggestions feel helpful not annoying, patterns are accurately identified

### 7. Tooling and Agent Actions
- **Functionality**: Modular tool framework with enable/disable/permission controls for web research, note creation, task creation, calendar planning, email drafting, document summarization, CRM, custom workflows
- **Purpose**: Provides extensible foundation for AI to take actions and integrate with external systems
- **Trigger**: AI decides to use tool during conversation or user explicitly requests tool action
- **Progression**: User grants tool permissions → AI identifies need for tool → Requests approval if required → Executes action → Shows result → Logs in audit trail
- **Success criteria**: Tool permissions are clear, execution is reliable, results are well-formatted, architecture supports easy addition of new tools

### 8. Prompt Studio / Behavior Studio
- **Functionality**: Advanced customization interface for editing global/mode-specific prompts, creating reusable blocks, defining response rules, reasoning styles, formatting defaults, tool-use rules, memory behavior, conditional rules with preview/test capability
- **Purpose**: Gives power users complete control over AI behavior at the prompt engineering level
- **Trigger**: User accesses Settings → Behavior Studio
- **Progression**: Browse current prompts → Edit system prompt or mode-specific → Test changes with preview → Save → Apply → Validate behavior in actual conversation
- **Success criteria**: Prompts save correctly, preview is accurate, changes apply immediately, interface is user-friendly despite complexity

### 9. Model and Runtime Controls
- **Functionality**: Settings for default model, fallback model, temperature, creativity/precision slider, max length, latency preference, citation preference, tool use aggressiveness, memory retrieval intensity, safe/strict mode
- **Purpose**: Provides fine-grained control over AI runtime behavior and performance characteristics
- **Trigger**: User accesses Settings → Model Controls
- **Progression**: Adjust sliders/toggles → Preview behavior impact → Save settings → Settings apply to all new conversations
- **Success criteria**: Settings persist, behavior changes are noticeable, sliders have intuitive labels, architecture supports multiple providers

### 10. Dashboard / Home
- **Functionality**: Command center showing today's priorities, active goals, recent conversations, memory highlights, AI insights, quick actions, upcoming items, focus recommendations, current projects
- **Purpose**: Provides single glance overview of everything important with quick access to deep features
- **Trigger**: User opens app or navigates to Home
- **Progression**: Load personalized dashboard → Scan priorities/insights → Take quick action → Navigate to detailed view → Return to dashboard
- **Success criteria**: Loads instantly, information is prioritized well, quick actions work reliably, feels like command center not cluttered feed

### 11. Onboarding Experience
- **Functionality**: Guided wizard asking about preferences, role, goals, desired companion style with intelligent defaults
- **Purpose**: Personalizes the experience from first use and educates users about capabilities
- **Trigger**: First app launch or user requests reset
- **Progression**: Welcome screen → Role/context questions → Personality style selection → Initial goals → Memory preferences → Quick tour → Land on personalized dashboard
- **Success criteria**: Feels welcoming not tedious, captures essential context, creates good initial state, users understand core features

## Edge Case Handling

- **Empty States** - Beautiful, actionable empty states for conversations, goals, memory, knowledge with clear CTAs guiding next steps
- **Offline Behavior** - Graceful degradation showing cached conversations and clear "reconnecting" states without data loss
- **Long Conversations** - Virtual scrolling and pagination for conversations exceeding thousands of messages with fast search
- **Memory Conflicts** - Detection and UI for conflicting memories with merge/resolve workflow
- **Corrupted Data** - Validation on load with repair suggestions and export capability before reset
- **Permission Denials** - Clear messaging when tool permissions are denied with alternative action suggestions
- **Slow LLM Responses** - Streaming with skeleton loaders, ability to cancel, and timeout handling with retry
- **Export Failures** - Chunked exports with progress indication and resume capability for large datasets

## Design Direction

The design should evoke **intelligent minimalism, premium craftsmanship, and calm focus**. This is a tool for serious thinking work and personal growth, not entertainment. The interface should feel like a beautifully designed operating system—spacious, confident, and sophisticated. Every element should communicate trust, capability, and personalization. The AI should feel like an extension of the user's mind, not a separate entity—integrated, persistent, and genuinely helpful.

## Color Selection

The color scheme balances **professional sophistication with warmth and depth**, using rich purples and ambers to create a premium, intelligent feel that's neither cold nor playful.

- **Primary Color**: Deep Violet `oklch(0.45 0.15 290)` - Communicates intelligence, depth, and premium quality; used for primary actions and brand moments
- **Secondary Color**: Warm Slate `oklch(0.35 0.02 260)` - Supporting color for secondary actions and backgrounds; provides professional depth without coldness
- **Accent Color**: Amber Gold `oklch(0.75 0.14 65)` - Draws attention to insights, highlights, and important interactive elements; adds warmth and energy
- **Muted Background**: Soft Charcoal `oklch(0.18 0.01 260)` - Main dark background that reduces eye strain during long sessions
- **Surface**: Elevated Slate `oklch(0.22 0.02 260)` - Cards and elevated surfaces that float above the background
- **Foreground/Background Pairings**:
  - Primary (Deep Violet): White text `oklch(0.98 0 0)` - Ratio 8.2:1 ✓
  - Secondary (Warm Slate): Light Violet `oklch(0.85 0.05 280)` - Ratio 7.1:1 ✓
  - Accent (Amber Gold): Slate text `oklch(0.20 0.02 260)` - Ratio 8.9:1 ✓
  - Surface (Elevated Slate): Soft White `oklch(0.92 0.01 280)` - Ratio 11.5:1 ✓
  - Background (Soft Charcoal): Pale Violet `oklch(0.88 0.03 280)` - Ratio 10.8:1 ✓

## Font Selection

Typography should convey **clarity, intelligence, and modern sophistication** while maintaining excellent readability for long-form reading and conversation. The combination should feel contemporary and purpose-built for a premium software experience.

**Primary Font**: Space Grotesk - A geometric sans-serif with technical elegance, used for headings, navigation, and UI elements to establish strong hierarchy and modern character
**Secondary Font**: Inter - Clean, highly legible sans-serif for body text, conversation content, and dense information displays ensuring comfortable extended reading
**Code Font**: JetBrains Mono - For any code blocks, technical content, or prompt editing with excellent character distinction

- **Typographic Hierarchy**:
  - H1 (Section Titles): Space Grotesk Bold / 32px / tight (-0.02em) letter spacing
  - H2 (Subsection Headers): Space Grotesk Semibold / 24px / tight letter spacing
  - H3 (Card Headers): Space Grotesk Medium / 18px / normal letter spacing
  - Body (Conversation Text): Inter Regular / 15px / relaxed (1.6) line height
  - Small (Metadata): Inter Medium / 13px / normal line height
  - Label (Form Labels): Inter Semibold / 13px / wide (0.02em) letter spacing
  - Code (Prompts): JetBrains Mono Regular / 14px / normal spacing

## Animations

Animations should be **purposeful, elegant, and physics-based**, enhancing the sense of intelligence and responsiveness without calling attention to themselves. Every motion should feel like natural cause-and-effect, making the interface feel alive and reactive. Use subtle spring physics for interactions that need personality (mode switching, card appearances) and quick easing for functional transitions (page changes, menu opens). Key moments: streaming text should have satisfying reveal, insight cards should float in with gentle spring, mode switching should feel transformative, and navigation should maintain spatial awareness.

## Component Selection

- **Components**: 
  - Navigation: Sidebar with collapsible sections and keyboard shortcuts overlay
  - Chat: ScrollArea with virtualized message list, Textarea with auto-resize, custom streaming message component
  - Cards: Card components with subtle shadows and hover states for goals, memories, insights
  - Forms: Form, Input, Textarea, Select, Switch, Slider for extensive settings
  - Modals: Dialog for important actions, Sheet for side panels (Memory detail, Knowledge preview)
  - Data Display: Table for memory management, Tabs for multi-view sections (goals timeframes), Badge for tags/categories
  - Command: Command palette (cmd+k) for power-user quick actions
  - Feedback: Toast (sonner) for confirmations, Alert for warnings, Progress for streaming/loading
  - Navigation: Breadcrumb for deep navigation contexts, Tabs for view switching

- **Customizations**:
  - Custom message bubble component with streaming animation and citation popover
  - Custom insight card with animated border gradient for high-priority items
  - Custom mode selector with visual preview of personality style
  - Custom memory visualization showing relationships between memory layers
  - Custom goal decomposition tree view with drag-to-reorder
  - Custom prompt editor with syntax highlighting for template variables

- **States**:
  - Buttons: Subtle scale on hover (0.98), press state with translateY(1px), disabled with reduced opacity and cursor-not-allowed
  - Inputs: Violet glow focus ring, smooth border color transition, helper text fades in
  - Cards: Lift on hover with shadow increase, amber left border appears on selection
  - Mode Selector: Background gradient crossfade between modes, scale and glow on active
  - Streaming Text: Character-by-character reveal with subtle fade-up per word

- **Icon Selection**: 
  - Phosphor Icons throughout for consistency
  - Navigation: House (home), ChatCircle (chat), Brain (memory), Books (knowledge), Target (goals), Lightning (workflows), Lightbulb (insights), Gear (settings)
  - Actions: Plus, MagnifyingGlass, FunnelSimple, Star/StarFill, ArchiveBox, PencilSimple, Trash
  - Status: CheckCircle, Warning, Info, X
  - AI: Sparkle for AI-generated content, Robot for companion identity

- **Spacing**: 
  - Consistent 8px base unit: 1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px), 12 (48px), 16 (64px)
  - Card padding: p-6 (24px) for comfortable density
  - Section spacing: space-y-8 (32px) between major sections
  - List items: space-y-2 (8px) for tight grouping, space-y-4 (16px) for breathing room
  - Page margins: px-6 md:px-8 lg:px-12 for responsive containment

- **Mobile**:
  - Bottom navigation bar replaces sidebar on mobile with 5 primary sections
  - Collapsible filters and settings into Sheet overlays
  - Stack dashboard cards vertically with full width
  - Chat input sticky at bottom with minimal chrome
  - Swipe gestures: right to go back, left on message for quick actions
  - Command palette accessible via floating action button
  - Reduced font sizes: H1 24px, body 14px while maintaining hierarchy
