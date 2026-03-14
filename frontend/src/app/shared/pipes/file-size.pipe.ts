import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fileSize',
  standalone: true
})
export class FileSizePipe implements PipeTransform {
  transform(bytes: string | number | null | undefined, precision: number = 1): string {
    if (bytes === null || bytes === undefined) return '0 B';
    
    let numBytes = typeof bytes === 'string' ? Number(bytes) : bytes;
    if (isNaN(numBytes) || numBytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));

    return parseFloat((numBytes / Math.pow(k, i)).toFixed(precision)) + ' ' + sizes[i];
  }
}
