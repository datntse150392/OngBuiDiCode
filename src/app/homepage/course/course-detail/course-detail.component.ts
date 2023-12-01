import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { Course } from 'src/app/models/CourseModel';
import { ConfigLocal } from 'src/app/models/Config/localState';
import { APIService } from 'src/app/service/APIservice.service';
import { CourseAPIService } from 'src/app/service/api/CourseAPI.service';
import { ConfirmationService } from 'primeng/api';
import { UserAPIService } from 'src/app/service/api/UserAPI.service';
import { ToastService } from 'src/app/service/ToastService.service';
@Component({
  selector: 'app-course-detail',
  templateUrl: './course-detail.component.html',
  styleUrls: ['./course-detail.component.scss'],
  providers: [ConfirmationService],
})
export class CourseDetailComponent implements OnInit {
  constLesson!: number;
  isExpand!: boolean;

  configLocal: ConfigLocal = {
    userInfo: {},
  };
  course!: Course;
  mainCourse!: TreeNode[];

  constructor(
    private route: ActivatedRoute,
    private APIservice: APIService,
    private courseAPIService: CourseAPIService,
    private confirmationService: ConfirmationService,
    private toastService: ToastService,
    private userAPIService: UserAPIService
  ) {}

  ngOnInit() {
    // Lấy giá trị của tham số 'id' từ URL
    const courseId = this.route.snapshot.params['id'];
    // Lưu courseId vào configCourse và lưu vào localStorage
    localStorage.setItem('courseId', courseId);
    // Subscribe to the Observable to get the Course data
    this.APIservice.getCoursebyId(courseId).subscribe((res: any) => {
      this.course = res.data;
    });
    this.APIservice.tranferMainCourseById(courseId).subscribe(
      (transformedData: TreeNode[]) => {
        this.mainCourse = transformedData;
        this.constLesson = this.mainCourse.length;
        console.log(this.mainCourse);
      }
    );
    try {
      this.configLocal.userInfo = this.parseData().userInfo;
    } catch (error) {
      console.log(error);
    }
  }

  expandAll() {
    this.isExpand = true;
    this.mainCourse.forEach((node) => {
      this.expandRecursive(node, true);
    });
  }

  collapseAll() {
    this.isExpand = false;
    this.mainCourse.forEach((node) => {
      this.expandRecursive(node, false);
    });
  }

  parseData() {
    const configLocalString = localStorage.getItem('configLocal');
    if (configLocalString) {
      const configLocal = JSON.parse(configLocalString);
      return configLocal;
    }
    return null;
  }

  private expandRecursive(node: TreeNode, isExpand: boolean) {
    node.expanded = isExpand;
    if (node.children) {
      node.children.forEach((childNode) => {
        this.expandRecursive(childNode, isExpand);
      });
    }
  }

  isCheckContainCourse() {
    if (
      this.configLocal.userInfo.enrolledCourses?.some(
        (course: Course) => this.course._id === course._id
      )
    ) {
      return true;
    }
    return false;
  }

  /*
    Logic handle when user enroll any course
  */
  confirmEnrollCourse(userId: any, courseId: any) {
    this.confirmationService.confirm({
      message: 'Bạn có đồng ý đăng ký khóa học này không?',
      header: 'Xác thực đăng ký khóa học',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.courseAPIService
          .enrollCourse(userId, courseId)
          .subscribe((res: any) => {
            try {
              if (res?.status === 200) {
                this.toastService.setToastIsEnrollCourse(true);
                this.userAPIService
                  .getUser(this.configLocal.userInfo.username)
                  .subscribe((res: any) => {
                    const user = res.data.user;
                    this.configLocal.userInfo = user;
                    localStorage.setItem(
                      'configLocal',
                      JSON.stringify(this.configLocal)
                    );
                  });
              } else if (res?.status === 400) {
                this.toastService.setToastIsEnrollCourse(false);
              }
            } catch (error) {
              this.toastService.setToastIsEnrollCourse(false);
            }
          });
      },
      reject: () => {
        this.toastService.setToastIsEnrollCourse(false);
      },
    });
  }
}
