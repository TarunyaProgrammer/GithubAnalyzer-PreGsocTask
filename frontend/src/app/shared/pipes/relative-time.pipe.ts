import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'relativeTime',
  standalone: true
})
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return 'Never';

    const date = new Date(value);
    const now = new Date();
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    const diffInMs = date.getTime() - now.getTime();
    const diffInSeconds = Math.round(diffInMs / 1000);
    const diffInMinutes = Math.round(diffInSeconds / 60);
    const diffInHours = Math.round(diffInMinutes / 60);
    const diffInDays = Math.round(diffInHours / 24);
    const diffInMonths = Math.round(diffInDays / 30);
    const diffInYears = Math.round(diffInDays / 365);

    if (Math.abs(diffInSeconds) < 60) return rtf.format(diffInSeconds, 'second');
    if (Math.abs(diffInMinutes) < 60) return rtf.format(diffInMinutes, 'minute');
    if (Math.abs(diffInHours) < 24) return rtf.format(diffInHours, 'hour');
    if (Math.abs(diffInDays) < 30) return rtf.format(diffInDays, 'day');
    if (Math.abs(diffInMonths) < 12) return rtf.format(diffInMonths, 'month');
    
    return rtf.format(diffInYears, 'year');
  }
}
