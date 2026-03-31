import { Routes } from '@angular/router';
import { FeedComponent } from './components/feed/feed.component';
import { ContentReviewComponent } from './components/content-review/content-review.component';
import { BiasDashboardComponent } from './components/bias-dashboard/bias-dashboard.component';
import { SurveyComponent } from './components/survey/survey.component';

export const routes: Routes = [
  { path: '', component: FeedComponent },
  { path: 'review', component: ContentReviewComponent },
  { path: 'dashboard', component: BiasDashboardComponent },
  { path: 'survey', component: SurveyComponent },
  { path: '**', redirectTo: '' }
];
