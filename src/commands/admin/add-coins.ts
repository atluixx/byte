import { BaseCommand } from '@root/types';

export class AddCoinsCommand extends BaseCommand {
    override name = 'add-coins';
    override category = 'admin';
    override description = 'Allows you to know your or others current amount of coins';
    override argsLength = 2;
}
