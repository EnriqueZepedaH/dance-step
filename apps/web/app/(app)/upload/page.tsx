import Link from "next/link";
import { WaitlistForm } from "@/components/lab/WaitlistForm";

export const metadata = {
  title: "The Lab · Research preview | DanceStep",
  description:
    "Pose tracking and move classification for Cuban Casino clips — research preview, coming in v2.",
};

export default function UploadPage() {
  return (
    <section className="page-shell">
      <span className="lab-banner">Research preview · Coming in v2</span>
      <span className="eyebrow bullet">The Lab</span>
      <h1 className="display">
        Upload a Casino clip.<br />
        Get it back in <em>moves</em>.
      </h1>

      <p className="lede">
        Pose tracking plus a vision model attempt to name every atomic
        move in your clip — guapea, enchufla, dile que no, siete — and
        lay them on a timeline you can replay at quarter speed.
      </p>

      <p className="lede">
        It&rsquo;s deferred to v2. Classification accuracy isn&rsquo;t
        good enough yet to build a product on, and DanceStep&rsquo;s
        value for v1 lives in <Link href="/library" className="lede-link">
          the Library
        </Link> and <Link href="/scene" className="lede-link">
          the Scene
        </Link> — where every dancer benefits whether the analyzer is
        90% accurate or 50%.
      </p>

      <div className="lab-pipeline">
        <h2 className="section-h2">What we&rsquo;re building toward</h2>
        <ol>
          <li>
            <strong>Pose extraction.</strong> MediaPipe runs on each
            frame to capture body and limb positions.
          </li>
          <li>
            <strong>Move classification.</strong> A small vision model
            inspects each pose-window and labels it with a Casino
            move (or marks it uncertain).
          </li>
          <li>
            <strong>Timeline editor.</strong> A scrubbable timeline
            shows the labels in sequence with confidence (clean,
            review, beta) so you can verify and re-train.
          </li>
        </ol>
      </div>

      <div className="lab-waitlist">
        <h2 className="section-h2">Get pinged when the preview opens</h2>
        <WaitlistForm />
      </div>
    </section>
  );
}
