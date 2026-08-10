import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension, type ChainedCommands } from "@tiptap/core";
import { useEffect } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Heading2, Heading3,
  Type, RotateCcw,
} from "lucide-react";

// Extension para tamanho de fonte via style
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return (chain() as any).setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => ChainedCommands }) => {
          return (chain() as any).setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
        },
    } as any;
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  readOnly?: boolean;
}

const FONT_SIZES = [
  { label: "Pequeno", value: "0.8rem" },
  { label: "Normal", value: "1rem" },
  { label: "Médio", value: "1.15rem" },
  { label: "Grande", value: "1.3rem" },
  { label: "Muito grande", value: "1.6rem" },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Digite aqui...",
  minHeight = "120px",
  className = "",
  readOnly = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { HTMLAttributes: { class: "list-disc pl-5 space-y-1" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-5 space-y-1" } },
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
    ],
    content: value || "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g., when form resets)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value]);

  if (!editor) return null;

  if (readOnly) {
    return (
      <div
        className={`prose prose-sm max-w-none text-slate-700 ${className}`}
        dangerouslySetInnerHTML={{ __html: value || "" }}
      />
    );
  }

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden bg-white ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        {/* Bold */}
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito (Ctrl+B)"
        >
          <Bold size={13} />
        </ToolbarButton>

        {/* Italic */}
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico (Ctrl+I)"
        >
          <Italic size={13} />
        </ToolbarButton>

        {/* Underline */}
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        {/* Heading 2 */}
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Título grande"
        >
          <Heading2 size={13} />
        </ToolbarButton>

        {/* Heading 3 */}
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Título médio"
        >
          <Heading3 size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        {/* Bullet list */}
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista com marcadores"
        >
          <List size={13} />
        </ToolbarButton>

        {/* Ordered list */}
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <ListOrdered size={13} />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        {/* Font size selector */}
        <div className="flex items-center gap-1">
          <Type size={11} className="text-slate-400" />
          <select
            className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white outline-none focus:border-blue-400 cursor-pointer"
            onChange={(e) => {
              const val = e.target.value;
              if (val === "") {
                (editor.chain().focus() as any).unsetFontSize().run();
              } else {
                (editor.chain().focus() as any).setFontSize(val).run();
              }
            }}
            defaultValue=""
            title="Tamanho da fonte"
          >
            <option value="">Tamanho</option>
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        {/* Clear formatting */}
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Limpar formatação"
        >
          <RotateCcw size={12} />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="px-3 py-2 text-sm text-slate-800 outline-none"
        style={{ minHeight }}
      />

      {/* Placeholder */}
      {editor.isEmpty && (
        <div
          className="absolute pointer-events-none text-slate-400 text-sm px-3 py-2"
          style={{ top: "auto" }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded text-xs transition-colors ${
        active
          ? "bg-blue-100 text-blue-700"
          : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

// CSS global para o editor TipTap — adicionar ao index.css
export const tiptapStyles = `
.ProseMirror {
  outline: none;
  min-height: inherit;
}
.ProseMirror p { margin: 0 0 0.4em; }
.ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin: 0.6em 0 0.3em; color: #1e293b; }
.ProseMirror h3 { font-size: 1.05rem; font-weight: 600; margin: 0.5em 0 0.25em; color: #334155; }
.ProseMirror ul { list-style: disc; padding-left: 1.25rem; margin: 0.3em 0; }
.ProseMirror ol { list-style: decimal; padding-left: 1.25rem; margin: 0.3em 0; }
.ProseMirror li { margin: 0.1em 0; }
.ProseMirror strong { font-weight: 700; }
.ProseMirror em { font-style: italic; }
.ProseMirror u { text-decoration: underline; }
`;
