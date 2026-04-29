import Link from "next/link";
import { ArrowLeft, FileVideo, UploadCloud } from "lucide-react";

export const metadata = {
  title: "Upload Demo | DanceStep",
  description: "Start a DanceStep upload demo for Cuban Casino video analysis.",
};

export default function UploadPage() {
  return (
    <main className="upload-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={18} />
        <span>Back to DanceStep</span>
      </Link>

      <section className="upload-demo">
        <div className="upload-copy">
          <span className="eyebrow">Upload demo</span>
          <h1>Start with one Casino clip.</h1>
          <p>
            The landing page is wired for the future analysis flow. This placeholder
            keeps the demo path usable until video upload, pose extraction, and move
            classification are connected.
          </p>
        </div>

        <div className="drop-zone">
          <UploadCloud size={42} />
          <strong>Drop a dance video here</strong>
          <p>MP4 or MOV, a few seconds to about five minutes.</p>
          <button type="button" disabled>
            <FileVideo size={18} />
            Choose video
          </button>
          <small>Upload processing is not connected yet.</small>
        </div>
      </section>
    </main>
  );
}
