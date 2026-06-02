import { Link } from "wouter";
import { useListCourses } from "@workspace/api-client-react";
import { ArrowLeft, GraduationCap, Loader2, Edit2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminCourses() {
  const { data: courses, isLoading } = useListCourses();

  return (
    <div className="container max-w-5xl py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Learning Courses</h1>
          <p className="text-muted-foreground mt-1">
            Browse a course to view and edit its module questions.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/courses-import">
            <GraduationCap className="mr-2 h-4 w-4" /> Courses Import
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !courses || courses.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <CardHeader>
            <CardTitle>No courses yet</CardTitle>
            <CardDescription>Import a course to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/courses-import">Courses Import</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold">{course.title}</h2>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {course.moduleCount} modules
                  </Badge>
                </div>
                {course.description && (
                  <p className="text-muted-foreground line-clamp-1 max-w-2xl">
                    {course.description}
                  </p>
                )}
              </div>
              <div className="mt-4 sm:mt-0">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/courses/${course.slug}`}>
                    <Edit2 className="mr-2 h-4 w-4" /> Edit Questions
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
