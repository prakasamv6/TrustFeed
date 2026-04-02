import { Routes } from '@angular/router';
import { trigger, transition, style, animate, query, group } from '@angular/animations';
import { FeedComponent } from './components/feed/feed.component';
import { ContentReviewComponent } from './components/content-review/content-review.component';
import { BiasDashboardComponent } from './components/bias-dashboard/bias-dashboard.component';
import { SurveyComponent } from './components/survey/survey.component';
import { SurveyResultsComponent } from './components/survey-results/survey-results.component';
import { TrendingComponent } from './components/trending/trending.component';

export const routeAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(8px)' })
    ], { optional: true }),
    group([
      query(':leave', [
        animate('200ms ease-out', style({ opacity: 0, transform: 'translateY(-8px)' }))
      ], { optional: true }),
      query(':enter', [
        animate('300ms 100ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ], { optional: true }),
    ]),
  ]),
]);

export const routes: Routes = [
  { path: '', component: FeedComponent, data: { animation: 'feed' } },
  { path: 'review', component: ContentReviewComponent, data: { animation: 'review' } },
  { path: 'dashboard', component: BiasDashboardComponent, data: { animation: 'dashboard' } },
  { path: 'trending', component: TrendingComponent, data: { animation: 'trending' } },
  { path: 'survey', component: SurveyComponent, data: { animation: 'survey' } },
  { path: 'survey-results', component: SurveyResultsComponent, data: { animation: 'survey-results' } },
  { path: '**', redirectTo: '' }
];
