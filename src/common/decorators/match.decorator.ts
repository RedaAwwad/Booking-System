import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export const Match = (property: string, validationOptions?: ValidationOptions): PropertyDecorator => {
  return (object: Object, propertyName: string) => {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const relatedPropertyName = args.constraints[0] as string;
          const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];
          return value === relatedValue;
        },
        defaultMessage: () => 'Passwords do not match',
      },
    });
  };
};
