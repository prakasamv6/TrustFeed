import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, tap } from 'rxjs';
import { environment } from './environment';

export interface OpenAIStatus {
  available: boolean;
  provider: string | null;
  models: {
    text: string;
    vision: string;
    embedding: string;
  } | null;
}

export interface OpenAITextResult {
  provider: string;
  model: string;
  ai_probability: number;
  confidence: number;
  reasoning: string;
  detected_patterns: string[];
  bias_indicators: string[];
  features: Record<string, unknown>;
}

export interface OpenAIImageResult {
  provider: string;
  model: string;
  ai_probability: number;
  confidence: number;
  reasoning: string;
  detected_artifacts: string[];
  style_classification: string;
}

export interface SimilarityResult {
  similarity: number;
  model: string;
}

@Injectable({ providedIn: 'root' })
export class OpenAIService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBase;

  /** Reactive signal showing OpenRouter availability */
  openaiAvailable = signal(false);
  openaiStatus = signal<OpenAIStatus | null>(null);

  constructor() {
    this.checkStatus();
  }

  /** Check if OpenRouter is configured on the backend */
  checkStatus(): void {
    this.http.get<OpenAIStatus>(`${this.apiBase}/ai/status`).pipe(
      tap(status => {
        this.openaiAvailable.set(status.available);
        this.openaiStatus.set(status);
      }),
      catchError(() => {
        this.openaiAvailable.set(false);
        this.openaiStatus.set(null);
        return of(null);
      }),
    ).subscribe();
  }

  /** Run text analysis via OpenRouter GPT-4o */
  analyzeText(content: string): Observable<OpenAITextResult> {
    return this.http.post<OpenAITextResult>(`${this.apiBase}/ai/analyze`, {
      content,
      contentType: 'text',
    });
  }

  /** Run image analysis via OpenRouter GPT-4o Vision */
  analyzeImage(mediaUrl: string): Observable<OpenAIImageResult> {
    return this.http.post<OpenAIImageResult>(`${this.apiBase}/ai/analyze`, {
      content: '',
      contentType: 'image',
      mediaUrl,
    });
  }

  /** Compute semantic similarity between two texts */
  computeSimilarity(textA: string, textB: string): Observable<SimilarityResult> {
    return this.http.post<SimilarityResult>(`${this.apiBase}/ai/similarity`, {
      textA,
      textB,
    });
  }
}
