import NotesBuddy from "@/components/notes-buddy";
import { SplashGate } from "@/components/splash-screen";
import { OnboardingGate } from "@/components/onboarding-welcome";

export default function Home() {
  return (
    <SplashGate>
      <OnboardingGate>
        <NotesBuddy />
      </OnboardingGate>
    </SplashGate>
  );
}

