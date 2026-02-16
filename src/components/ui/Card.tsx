import { ReactNode, MouseEventHandler } from 'react';
import { cn } from '@/utils/helpers';

export interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: MouseEventHandler<HTMLDivElement>;
  role?: string;
  tabIndex?: number;
}

export function Card({
  children,
  className,
  hover,
  padding = 'md',
  onClick,
  role,
  tabIndex,
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8',
  };
  
  return (
    <div
      className={cn(
        'card',
        paddingClasses[padding],
        hover && 'card-hover',
        className
      )}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function CardHeader({ title, description, action, className, children }: CardHeaderProps) {
  if (children) {
    return <div className={cn('mb-4', className)}>{children}</div>;
  }
  
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        {title && <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>}
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {action && <div className="ml-4">{action}</div>}
    </div>
  );
}

export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-neutral-900', className)}>
      {children}
    </h3>
  );
}

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
}
