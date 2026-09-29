import { notFound } from "next/navigation";
import FarmPreviewClient from "./preview-client";

export const metadata = {
  title: "FarmQuest — Prévia Visual",
  robots: {
    index: false,
    follow: false
  }
};

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <FarmPreviewClient />;
}
