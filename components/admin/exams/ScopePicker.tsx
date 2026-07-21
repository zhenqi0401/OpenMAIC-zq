'use client';

import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { examCourseScopeLabel } from '@/lib/admin/exam-policy-scope';
import type { ExamCategory } from '@/lib/admin/exam-policy-presentation';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

export function ScopePicker({
  categories,
  categoryIds,
  courses,
  courseIds,
  onCategoryToggle,
  onClearCourses,
  onCourseToggle,
}: {
  categories: readonly ExamCategory[];
  categoryIds: readonly string[];
  courses: readonly EnterpriseCourse[];
  courseIds: readonly string[];
  onCategoryToggle: (categoryId: string) => void;
  onClearCourses: () => void;
  onCourseToggle: (courseId: string) => void;
}) {
  const emptyText =
    categoryIds.length === 0 ? '请先选择课程分类' : '所选分类下暂无可选的已发布课程';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-medium text-[#75665d]">课程分类</div>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 ? (
            <span className="text-sm text-[#75665d]">暂无课程分类</span>
          ) : (
            categories.map((category) => (
              <label
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#d8c8b9] bg-[#fffaf2] px-2 py-1.5 text-xs"
                key={category.id}
              >
                <input
                  checked={categoryIds.includes(category.id)}
                  onChange={() => onCategoryToggle(category.id)}
                  type="checkbox"
                />
                {category.name}
              </label>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-medium text-[#75665d]">课程范围</div>
        <div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label="搜索并选择课程"
                className="min-w-[230px] justify-between rounded-[4px] border-[#d8c8b9] bg-[#fffaf2] font-normal"
                type="button"
                variant="outline"
              >
                <span className="truncate">{examCourseScopeLabel([...courseIds])}</span>
                <ChevronsUpDown className="size-4 text-[#75665d]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(360px,calc(100vw-2rem))] rounded-[6px] border-[#d8c8b9] bg-[#fffaf2] p-0 text-[#2b211d]"
            >
              <Command className="rounded-[6px]! bg-[#fffaf2] text-[#2b211d]">
                <CommandInput placeholder="搜索课程名称" />
                <CommandList>
                  <CommandEmpty className="text-[#75665d]">{emptyText}</CommandEmpty>
                  {courses.length > 0 ? (
                    <CommandGroup heading="已发布课程">
                      {courses.map((course) => (
                        <CommandItem
                          data-checked={courseIds.includes(course.id)}
                          key={course.id}
                          onSelect={() => onCourseToggle(course.id)}
                          value={course.name}
                        >
                          <span className="truncate">{course.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                </CommandList>
                <div className="border-t border-[#eaded1] p-2">
                  <Button
                    className="w-full justify-center rounded-[4px]"
                    disabled={courseIds.length === 0}
                    onClick={onClearCourses}
                    type="button"
                    variant="outline"
                  >
                    恢复全部课程
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#75665d]">
          空选择表示使用所选分类下全部已发布课程。
        </p>
      </div>
    </div>
  );
}
