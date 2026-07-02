import { TERMS_OF_SERVICE } from '@manamap/shared';
import { LegalDocument } from '../components/LegalDocument';

export function TermsPage() {
  return <LegalDocument doc={TERMS_OF_SERVICE} />;
}
