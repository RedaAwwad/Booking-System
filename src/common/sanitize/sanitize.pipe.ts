import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { sanitize } from 'class-sanitizer';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class SanitizePipe implements PipeTransform {
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  transform(value: any, metadata: ArgumentMetadata) {
    // 1. Skip if no metatype, if value is empty/not an object, or if metatype is a built-in primitive/generic JS type
    if (!metadata.metatype || !value || typeof value !== 'object' || !this.toValidate(metadata.metatype)) {
      return value;
    }

    // 2. Convert raw input into an instance of the target class
    const object = plainToInstance(metadata.metatype, value);

    // 3. Sanitize the object in-place (removes xss, etc.)
    if (object && typeof object === 'object') {
      sanitize(object);
    }

    return object;
  }
}
