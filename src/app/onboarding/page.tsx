import { redirect } from 'next/navigation';
import { loadGame } from '../actions';
import { OnboardingForm } from '@/components/OnboardingForm';

export default async function Onboarding() {
  const game = await loadGame();
  if (!game) redirect('/login');
  if (game.hasCustomSubjects) redirect('/');

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-9">
      <div className="text-center">
        <h1 className="font-display text-2xl">What are your 5 things?</h1>
        <p className="mt-2 text-sm text-navy/60">
          Name the 5 subjects you&apos;re studying. You can rename any of them later.
        </p>
      </div>
      <OnboardingForm defaultLabels={game.labels} />
    </main>
  );
}