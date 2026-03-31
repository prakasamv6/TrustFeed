import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const consentGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (sessionStorage.getItem('consent_accepted') === 'true') {
    return true;
  }
  return router.createUrlTree(['/']);
};
