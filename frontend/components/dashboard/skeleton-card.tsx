import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export function SkeletonCard() {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-4 w-3/4 bg-muted rounded" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-2/3 bg-muted rounded" />
      </CardContent>
      <CardFooter>
        <div className="h-3 w-1/3 bg-muted rounded" />
      </CardFooter>
    </Card>
  );
}
