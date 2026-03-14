import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';

const cache = new Map<string, { data: HttpResponse<unknown>; expiry: number }>();
const TTL = 30000; // 30 seconds

export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next(req);
  }

  const cacheKey = req.urlWithParams;
  const cachedResponse = cache.get(cacheKey);

  if (cachedResponse && cachedResponse.expiry > Date.now()) {
    return of(cachedResponse.data);
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        cache.set(cacheKey, { data: event, expiry: Date.now() + TTL });
      }
    })
  );
};
