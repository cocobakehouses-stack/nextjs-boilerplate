export function DataTable({children,className}:{children:React.ReactNode;className?:string}){
  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-white', className)}>
      <table className="table">{children}</table>
    </div>
  );
}
