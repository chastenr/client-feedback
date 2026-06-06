import { redirect } from 'next/navigation';

export default function LegacyReviewPage({ params }: { params: { id: string } }) {
  redirect(`/client/${params.id}`);
}
