import { SECTIONS } from "@mezo/api/profile-fields";
import { redirect } from "next/navigation";

/** `/settings` is the nav's landing point; the first section is the page. */
export default function SettingsPage() {
	redirect(`/settings/${SECTIONS[0]?.slug ?? "profile"}`);
}
