import React, { useMemo } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FONT_FAMILIES, toHtml } from "@/lib/richTextPdf";

const SIZES = ["12px", false, "18px", "24px"];
const Size = Quill.import("attributors/style/size"); Size.whitelist = SIZES.filter(Boolean); Quill.register(Size, true);
const Font = Quill.import("attributors/style/font"); Font.whitelist = FONT_FAMILIES.slice(1).map((f) => f.value); Quill.register(Font, true);
Quill.register(Quill.import("attributors/style/align"), true);

const COLORS = ["#1f2937", "#73000A", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#6b7280"];

export default function RichTextBox({ value, onChange, placeholder, minHeight = 120 }) {
  const modules = useMemo(() => ({
    toolbar: [[{ font: [false, ...FONT_FAMILIES.slice(1).map((f) => f.value)] }, { size: SIZES }], ["bold"], [{ color: COLORS }], [{ list: "ordered" }, { list: "bullet" }], [{ align: [] }]],
  }), []);
  return (
    <div className="rs-rich" style={{ "--rich-min": `${minHeight}px` }}>
      <ReactQuill theme="snow" value={toHtml(value)} onChange={(html, _d, source) => { if (source === "user") onChange(html === "<p><br></p>" ? "" : html); }} modules={modules} placeholder={placeholder} />
    </div>
  );
}
