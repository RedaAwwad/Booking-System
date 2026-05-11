import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { sanitize } from 'class-sanitizer';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // 1. Check if metatype exists (it might not for simple primitives/strings)
    if (!metadata.metatype) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    }

    // 2. Convert raw input into an instance of the target class
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const object = plainToInstance(metadata.metatype, value);

    // 3. Sanitize the object in-place (removes xss, etc.)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    sanitize(object);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return object;
  }
}
