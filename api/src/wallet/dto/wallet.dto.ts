import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsString, Matches, MaxLength, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Identifiant de compte panel (UUID ou identifiant technique) : jamais de caractères exotiques. */
const USER_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

export class AddFundsDto {
  @IsString()
  @Matches(USER_ID_RE, { message: 'userId invalide' })
  userId!: string;

  /** Positif = crédit, négatif = débit. Deux décimales maximum ; jamais nul (contrôlé dans le service). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000)
  @Max(1_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class DeleteTransactionsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  ids!: string[];
}

export class ClearHistoryDto {
  @IsString()
  @Matches(USER_ID_RE, { message: 'userId invalide' })
  userId!: string;
}
