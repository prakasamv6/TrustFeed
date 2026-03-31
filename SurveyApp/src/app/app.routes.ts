import { Routes } from '@angular/router';
import { ConsentWaiverComponent } from './components/consent-waiver/consent-waiver.component';
import { SurveyComponent } from './components/survey/survey.component';
import { consentGuard } from './guards/consent.guard';

export const routes: Routes = [
  { path: '', component: ConsentWaiverComponent },
  { path: 'survey', component: SurveyComponent, canActivate: [consentGuard] },
  { path: '**', redirectTo: '' },
];
