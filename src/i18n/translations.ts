import { AppLanguage } from '../types';

export type TranslationKey = 
  | 'nav_home'
  | 'nav_schedule'
  | 'nav_students'
  | 'nav_history'
  | 'nav_payments'
  | 'nav_reports'
  | 'nav_settings'
  | 'nav_quickLesson'
  | 'nav_more'
  | 'nav_widgets'
  | 'goodMorning'
  | 'goodAfternoon'
  | 'goodEvening'
  | 'greeting'
  | 'refreshData'
  | 'dataRefreshed'
  | 'upcomingLessonAlert'
  | 'open'
  | 'save'
  | 'cancel'
  | 'delete'
  | 'edit'
  | 'add'
  | 'search'
  | 'all'
  | 'filter'
  | 'status'
  | 'date'
  | 'time'
  | 'notes'
  | 'confirm'
  | 'back'
  | 'close'
  | 'actions'
  | 'copied'
  | 'yes'
  | 'no'
  | 'archive'
  | 'status_completed'
  | 'status_cancelled'
  | 'status_upcoming'
  | 'status_in_progress'
  | 'status_pending'
  | 'status_scheduled'
  | 'att_present'
  | 'att_absent'
  | 'att_late'
  | 'hw_assigned'
  | 'hw_completed'
  | 'hw_not_completed'
  | 'settings_title'
  | 'settings_sub'
  | 'settings_language'
  | 'settings_lang_desc'
  | 'settings_parent_comm_notice'
  | 'settings_theme'
  | 'settings_theme_light'
  | 'settings_theme_dark'
  | 'settings_profile'
  | 'settings_name'
  | 'settings_email'
  | 'settings_currency'
  | 'settings_working_hours'
  | 'settings_start_time'
  | 'settings_end_time'
  | 'settings_payment_details'
  | 'settings_phone'
  | 'settings_instapay'
  | 'settings_vodafone'
  | 'settings_bank'
  | 'settings_payment_link'
  | 'settings_share_payment'
  | 'settings_backup'
  | 'settings_download_backup'
  | 'settings_restore_backup'
  | 'settings_clear_data'
  | 'settings_save_success'
  | 'schedule_title'
  | 'schedule_today'
  | 'schedule_week'
  | 'schedule_month'
  | 'schedule_add_lesson'
  | 'schedule_start_now'
  | 'schedule_no_lessons'
  | 'schedule_conflict'
  | 'schedule_working_hours'
  | 'schedule_refresh'
  | 'schedule_ical'
  | 'schedule_no_conflicts'
  | 'schedule_day_view'
  | 'schedule_week_view'
  | 'schedule_month_view'
  | 'schedule_reschedule'
  | 'schedule_new_date'
  | 'schedule_new_time'
  | 'schedule_conflict_alert'
  | 'schedule_reschedule_success'
  | 'schedule_weekly'
  | 'schedule_no_lessons_day'
  | 'schedule_add_lesson_for'
  | 'lesson_control_title'
  | 'lesson_timer'
  | 'lesson_duration'
  | 'lesson_start'
  | 'lesson_resume'
  | 'lesson_pause'
  | 'lesson_end'
  | 'lesson_cancel'
  | 'lesson_report_form'
  | 'lesson_show_timer'
  | 'lesson_attendance'
  | 'lesson_homework'
  | 'lesson_teacher_notes'
  | 'lesson_parent_report_btn'
  | 'lesson_save_report'
  | 'students_title'
  | 'students_tab_all'
  | 'students_tab_groups'
  | 'students_add_student'
  | 'students_add_group'
  | 'students_search_placeholder'
  | 'students_search_group_placeholder'
  | 'students_group_name'
  | 'students_student_name'
  | 'students_grade'
  | 'students_parent_phone'
  | 'students_student_phone'
  | 'students_package'
  | 'students_no_students'
  | 'students_no_groups'
  | 'students_group'
  | 'students_individual'
  | 'students_active'
  | 'students_archived'
  | 'students_lessons_count'
  | 'students_phone'
  | 'students_parent_phone_label'
  | 'students_details'
  | 'students_all_grades'
  | 'students_no_students_found'
  | 'students_all_days'
  | 'students_today'
  | 'students_archive_info'
  | 'students_archived_students_title'
  | 'students_no_archived_students'
  | 'students_archived_groups_title'
  | 'students_no_archived_groups'
  | 'students_restore'
  | 'students_reset_filters'
  | 'history_title'
  | 'history_header_sub'
  | 'history_total_lessons'
  | 'history_completed'
  | 'history_cancelled_missed'
  | 'history_total_hours'
  | 'history_filter_all'
  | 'history_filter_completed'
  | 'history_filter_cancelled'
  | 'history_filter_pending'
  | 'history_search_placeholder'
  | 'history_search'
  | 'history_export'
  | 'history_filter_entity_label'
  | 'history_all_entities'
  | 'history_groups_category'
  | 'history_students_category'
  | 'history_filter_period_label'
  | 'history_period_all'
  | 'history_period_today'
  | 'history_period_this_week'
  | 'history_period_this_month'
  | 'history_results_count'
  | 'history_reset_filters'
  | 'payments_title'
  | 'payments_total_collected'
  | 'payments_total_pending'
  | 'payments_record'
  | 'payments_send_reminder'
  | 'payments_paid'
  | 'payments_unpaid'
  | 'payments_partial'
  | 'payments_collected'
  | 'payments_pending'
  | 'payments_plan'
  | 'payments_history'
  | 'payments_method'
  | 'payments_due_date'
  | 'payments_daily'
  | 'payments_weekly'
  | 'payments_monthly'
  | 'payments_total_pending_label'
  | 'payments_open_tab'
  | 'payments_history_tab'
  | 'payments_all_groups'
  | 'payments_no_due_title'
  | 'payments_no_due_desc'
  | 'payments_completed_dates_label'
  | 'payments_pending_expectation'
  | 'payments_amount_due'
  | 'payments_mark_paid'
  | 'payments_mark_not_yet'
  | 'payments_notify_parent_wa'
  | 'payments_no_history'
  | 'payments_history_auto_archive'
  | 'payments_paid_on'
  | 'payments_notice_title'
  | 'payments_copy_text'
  | 'payments_copied'
  | 'payments_open_whatsapp'
  | 'payments_daily_gain_title'
  | 'payments_weekly_gain_title'
  | 'payments_monthly_gain_title'
  | 'payments_gain_summary_sub'
  | 'payments_total_gains'
  | 'payments_paid_cycles'
  | 'payments_details_header'
  | 'payments_no_paid_period'
  | 'payments_monthly_gain'
  | 'payments_weekly_gain'
  | 'payments_daily_gain'
  | 'payments_weekly_summary'
  | 'payments_pending_tag'
  | 'payments_parent_notice'
  | 'payments_paid_btn'
  | 'payments_not_yet_btn'
  | 'payments_no_due_sub'
  | 'payments_no_cycles_period'
  | 'payments_monthly_summary'
  | 'payments_history_sub'
  | 'payments_due_tab'
  | 'payments_details_heading'
  | 'payments_daily_summary'
  | 'payments_completed_cycle'
  | 'payments_overdue'
  | 'payments_expected'
  | 'payments_revenue_overview'
  | 'reports_title'
  | 'reports_header_sub'
  | 'reports_print_pdf'
  | 'reports_collected_revenue'
  | 'reports_from_paid_sessions'
  | 'reports_unpaid_amount'
  | 'reports_pending_payments'
  | 'reports_sessions_completed'
  | 'reports_total_conducted'
  | 'reports_unpaid_last_sessions'
  | 'reports_urgent_collect'
  | 'reports_all_good'
  | 'reports_weekly_protocol'
  | 'reports_weekly_protocol_sub'
  | 'reports_filter_all'
  | 'reports_filter_this_week'
  | 'reports_filter_paid'
  | 'reports_filter_unpaid'
  | 'reports_no_sessions_filter'
  | 'reports_weekly_chart_title'
  | 'reports_attendance_overview_title'
  | 'reports_total_lessons'
  | 'reports_active_students'
  | 'reports_attendance_rate'
  | 'reports_lessons_completed'
  | 'reports_revenue'
  | 'reports_students'
  | 'reports_export_pdf'
  | 'daily_stats_lessons_today'
  | 'daily_stats_students_today'
  | 'daily_stats_revenue_today'
  | 'daily_stats_completed'
  | 'daily_stats_monthly_overview'
  | 'daily_stats_students'
  | 'daily_stats_groups'
  | 'daily_stats_completed_short'
  | 'daily_stats_revenue'
  | 'tomorrows_lessons_title'
  | 'no_lessons_tomorrow'
  | 'weekly_overview_title'
  | 'weekly_overview_sub'
  | 'stat_remaining'
  | 'stat_cancelled'
  | 'stat_uncollected'
  | 'stat_total_expected'
  | 'smart_summary_title'
  | 'smart_summary_badge'
  | 'smart_summary_today'
  | 'smart_summary_expected_income'
  | 'smart_summary_first_lesson'
  | 'smart_summary_overdue_students'
  | 'smart_summary_todays_lessons'
  | 'smart_summary_todays_students'
  | 'smart_summary_no_lessons_regular'
  | 'next_action_title'
  | 'next_action_no_lessons'
  | 'next_action_today'
  | 'next_action_tomorrow'
  | 'next_action_this_week'
  | 'next_action_all'
  | 'next_action_online'
  | 'next_action_offline'
  | 'next_action_open'
  | 'time_in_progress'
  | 'time_starts_in'
  | 'time_starts_at'
  | 'time_scheduled_today'
  | 'timeline_title'
  | 'todays_lessons_title'
  | 'timeline_pending_action'
  | 'past_pending_lessons_title'
  | 'past_pending_lessons_desc'
  | 'timeline_requires_action'
  | 'timeline_pending_desc'
  | 'timeline_no_lessons'
  | 'timeline_completed_of'
  | 'timeline_live_now'
  | 'timeline_upcoming'
  | 'timeline_group'
  | 'timeline_individual'
  | 'system_time'
  | 'sofort_badge'
  | 'sofort_title'
  | 'sofort_desc'
  | 'quick_lesson_modal_title'
  | 'quick_lesson_modal_desc'
  | 'students_and_groups_title'
  | 'session_history_modal_title'
  | 'daily_gain_label'
  | 'weekly_gain_label'
  | 'monthly_gain_label'
  | 'open_payments_tab'
  | 'payment_history_tab'
  | 'all_groups_option'
  | 'no_due_payments_title'
  | 'no_due_payments_desc'
  | 'dismiss_from_dashboard'
  | 'todo_widget_title'
  | 'todo_add_placeholder'
  | 'todo_no_tasks'
  | 'todo_add_btn'
  | 'reports_and_analytics_title'
  | 'notifications_title'
  | 'free_time_available_today'
  | 'nav_free_time'
  | 'add_group_title'
  | 'add_group_subtitle'
  | 'lesson_duration_label'
  | 'schedule_lesson_title'
  | 'save_lesson_btn'
  | 'duplicate_student_warning'
  | 'students_all_groups'
  | 'payments_no_due'
  | 'payment_plan_lessons'
  | 'payments_completed_dates'
  | 'reports_copied'
  | 'reports_and_analyses'
  | 'lesson_session_num'
  | 'daily_stats_student'
  | 'todo_more_tasks'
  | 'auto_please_enter_student_name'
  | 'auto_parent_phone_number_is_require'
  | 'auto_import_group_students_with_a'
  | 'auto_create_group_and_all_students'
  | 'auto_ai_import'
  | 'auto_create_a_student_for_this_grou'
  | 'auto_initial_student_information'
  | 'auto_student_name'
  | 'auto_e_g_ahmed_ali'
  | 'auto_parent_name'
  | 'auto_e_g_ali_mahmoud'
  | 'auto_parent_phone'
  | 'auto_grade'
  | 'auto_student_notes'
  | 'auto_additional_student_notes'
  | 'auto_save_group'
  | 'auto_parent_phone_number_is_require_1'
  | 'auto_add_new_student'
  | 'auto_automatic_group_pricing_inheri'
  | 'auto_assigned_group'
  | 'auto_inherited_pricing'
  | 'auto_package'
  | 'auto_sessions'
  | 'auto_inherited_automatically_from'
  | 'auto_grade_level'
  | 'auto_parent_phone_2'
  | 'auto_student_phone_optional'
  | 'auto_special_focus_notes_or_weakn'
  | 'auto_save_student'
  | 'auto_import_group_students_ai_te'
  | 'auto_create_an_entire_group_and_all'
  | 'auto_group_students_imported_succ'
  | 'auto_group_name'
  | 'auto_grade_level_3'
  | 'auto_students_imported'
  | 'auto_students'
  | 'auto_schedule'
  | 'auto_view_group_profile'
  | 'auto_close'
  | 'auto_copy_prompt_orders_for_ai'
  | 'auto_prompt_copied'
  | 'auto_copy_ai_prompt_orders'
  | 'auto_copied'
  | 'auto_sample_data'
  | 'auto_click_copy_ai_prompt_orders'
  | 'auto_ai_generated_text'
  | 'auto_strict_zero_data_loss_validati'
  | 'auto_all_fields_validated_success'
  | 'auto_data_preview_before_import'
  | 'auto_students_4'
  | 'auto_group_name_5'
  | 'auto_grade_type'
  | 'auto_days_time'
  | 'auto_zoom_link'
  | 'auto_address'
  | 'auto_student_name_6'
  | 'auto_parent_phone_req'
  | 'auto_student_phone_opt'
  | 'auto_cancel'
  | 'auto_confirm_import'
  | 'auto_share_session_report'
  | 'auto_bulk_group_report_groups'
  | 'auto_individual_student_report'
  | 'auto_select_a_student_to_preview'
  | 'auto_student'
  | 'auto_not_specified'
  | 'auto_parent_phone_7'
  | 'auto_not_registered'
  | 'auto_group'
  | 'auto_german_group'
  | 'auto_whatsapp_group_connected'
  | 'auto_group_link_not_linked_yet'
  | 'auto_tip_you_can_edit_the_group_to'
  | 'auto_preview_edit_message'
  | 'auto_copy_text'
  | 'auto_send_to_whatsapp_group'
  | 'auto_send_via_whatsapp'
  | 'auto_print'
  | 'auto_phone_call'
  | 'auto_go_to_homescreen'
  | 'auto_free_hours'
  | 'auto_slots'
  | 'auto_next_slot'
  | 'auto_none'
  | 'auto_excellent'
  | 'auto_needs_cleanup'
  | 'auto_critical'
  | 'auto_students_without_group'
  | 'auto_sessions_without_group'
  | 'auto_calendar_sessions_without_grou'
  | 'auto_payments_without_group'
  | 'auto_attendance_records_without_gro'
  | 'auto_homework_records_without_group'
  | 'auto_exam_records_without_group'
  | 'auto_data_health_center'
  | 'auto_last_scan_lastscantime'
  | 'auto_scan_database'
  | 'auto_data_health_summary'
  | 'auto_database_health_score'
  | 'auto_healthy_records'
  | 'auto_orphaned_records'
  | 'auto_storage_used'
  | 'auto_clean_all_orphan_data'
  | 'auto_data_integrity_cleanup'
  | 'auto_detect_unlinked_orphaned_data'
  | 'auto_1_students_without_group'
  | 'auto_student_records_whose_groupid'
  | 'auto_2_sessions_without_group'
  | 'auto_lesson_sessions_whose_groupid'
  | 'auto_3_calendar_sessions_without_g'
  | 'auto_calendar_events_whose_groupid'
  | 'auto_4_payments_without_group'
  | 'auto_payment_records_linked_to_miss'
  | 'auto_5_attendance_records_without'
  | 'auto_attendance_records_linked_to_m'
  | 'auto_6_homework_records_without_gr'
  | 'auto_homework_records_linked_to_mis'
  | 'auto_7_exam_quiz_records_without_g'
  | 'auto_exam_results_linked_to_missing'
  | 'auto_profile_field_integrity'
  | 'auto_students_with_complete_data'
  | 'auto_students_missing_parent_phone'
  | 'auto_fix_now'
  | 'auto_groups_missing_schedule'
  | 'auto_groups_missing_session_price'
  | 'auto_online_groups_missing_zoom_lin'
  | 'auto_offline_groups_missing_locatio'
  | 'auto_total_orphaned_records_getc'
  | 'auto_no_orphaned_records_in_this_ca'
  | 'auto_delete_all_in_category'
  | 'auto_cleanup_orphan_data'
  | 'auto_the_selected_records_are_not_l'
  | 'auto_records_to_delete_singledel'
  | 'auto_this_action_cannot_be_undone'
  | 'auto_delete_permanently'
  | 'auto_cleanup_complete'
  | 'auto_dashboard_views_automaticall'
  | 'auto_deleted_records_breakdown'
  | 'auto_sessions_8'
  | 'auto_calendar_events'
  | 'auto_payments'
  | 'auto_attendance'
  | 'auto_homework'
  | 'auto_exams'
  | 'auto_storage_recovered_cleanupre'
  | 'auto_done'
  | 'auto_view'
  | 'auto_delete_all'
  | 'auto_delete_this_record'
  | 'auto_zoom_link_is_required_for_onli'
  | 'auto_address_location_is_required'
  | 'auto_refresh_data'
  | 'auto_daily_inspiration'
  | 'auto_teacher_reminder_motivation'
  | 'auto_another_message'
  | 'auto_dismiss'
  | 'auto_quick_review'
  | 'auto_report_saved'
  | 'auto_1_attendance'
  | 'auto_present'
  | 'auto_late'
  | 'auto_absent'
  | 'auto_2_homework'
  | 'auto_completed'
  | 'auto_assigned'
  | 'auto_not_completed'
  | 'auto_3_teacher_notes'
  | 'auto_edit_report'
  | 'auto_before_starting'
  | 'auto_send_lesson_reminder'
  | 'auto_open_zoom_link'
  | 'auto_open_google_meet'
  | 'auto_send_lesson_started_notice'
  | 'auto_send_payment_request'
  | 'auto_open_google_maps_navigation'
  | 'auto_live_lesson_timer'
  | 'auto_completed_9'
  | 'auto_cancelled'
  | 'auto_in_progress'
  | 'auto_paused'
  | 'auto_scheduled'
  | 'auto_duration_selectedlesson_dur'
  | 'auto_elapsed_time'
  | 'auto_start_session'
  | 'auto_cancel_session'
  | 'auto_resume_session'
  | 'auto_pause'
  | 'auto_confirm_lesson_cancellation'
  | 'auto_are_you_sure_you_want_to_cance'
  | 'auto_enter_cancellation_reason_opt'
  | 'auto_back'
  | 'auto_yes_cancel_lesson'
  | 'auto_unified_session_report'
  | 'auto_hide_report'
  | 'auto_subject_taught_content_less'
  | 'auto_enter_topics_taught_new_gramm'
  | 'auto_next_homework_assigned_to_stud'
  | 'auto_enter_details_of_homework_pag'
  | 'auto_status_performance_of_eac'
  | 'auto_previous_homework_lastse'
  | 'auto_present_10'
  | 'auto_absent_11'
  | 'auto_previous_homework_performance'
  | 'auto_completed_12'
  | 'auto_not_completed_13'
  | 'auto_dictation_grade_out_of_10'
  | 'auto_exam_quiz_grade_out_of_10'
  | 'auto_parent_student_notes_option'
  | 'auto_e_g_excellent_listening_skill'
  | 'auto_absent_exempt_from_grades'
  | 'auto_please_complete_the_following'
  | 'auto_subject_taught_field'
  | 'auto_next_homework_field'
  | 'auto_homework_status'
  | 'auto_dictation_grade'
  | 'auto_exam_grade'
  | 'auto_student_14'
  | 'auto_needs'
  | 'auto'
  | 'auto_end_session_save_report'
  | 'auto_parent_communication'
  | 'auto_egp'
  | 'auto_back_to_settings'
  | 'auto_notification_alert_settings'
  | 'auto_sync_schedule'
  | 'auto_customize_all_system_notificat'
  | 'auto_no_pending_scheduled_notificat'
  | 'auto_click_rebuild_schedules_to_p'
  | 'auto_automatic_system_alerts'
  | 'auto_mark_all_as_read'
  | 'auto_clear_all'
  | 'auto_no_new_notifications'
  | 'auto_open_lesson'
  | 'auto_completed_lesson_dates'
  | 'auto_flexible_prorated_billing'
  | 'auto_you_can_end_the_current_cycle'
  | 'auto_there_are_currently_no_student'
  | 'auto_prorated_amount'
  | 'auto_attended_lessons'
  | 'auto_lessons'
  | 'auto_force_cycle_bill'
  | 'auto_force_end_current_cycle_bill'
  | 'auto_student_name_15'
  | 'auto_group_16'
  | 'auto_attendance_progress'
  | 'auto_attended_proratemodalitem_le'
  | 'auto_completed_lesson_dates_17'
  | 'auto_adjust_prorated_due_amount'
  | 'auto_the_suggested_amount_is_calc'
  | 'auto_mark_as_unpaid_invoice'
  | 'auto_flexible_prorated_payment_p'
  | 'auto_mark_paid_now'
  | 'auto_profile_work_schedule'
  | 'auto_personal_information_contact'
  | 'auto_payments_finance'
  | 'auto_financial_information_transfe'
  | 'auto_messages_communication'
  | 'auto_automated_parent_communication'
  | 'auto_6_templates'
  | 'auto_notifications_alerts'
  | 'auto_reminders_lesson_alerts_dai'
  | 'auto_active'
  | 'auto_disabled'
  | 'auto_appearance_language'
  | 'auto_personalize_the_interface_expe'
  | 'auto_motivation_gratitude'
  | 'auto_daily_inspiration_and_positive'
  | 'auto_daily'
  | 'auto_before_lesson'
  | 'auto_random'
  | 'auto_data_backup'
  | 'auto_backup_restore_and_data_manag'
  | 'auto_about'
  | 'auto_application_information_and_ve'
  | 'auto_select_a_section_to_manage_app'
  | 'auto_search_settings'
  | 'auto_no_results_found'
  | 'auto_select_a_category'
  | 'auto_choose_a_category_from_the_sid'
  | 'auto_language_appearance'
  | 'auto_choose_application_language_an'
  | 'auto_note_the_selected_language_ap'
  | 'auto_accent_color'
  | 'auto_select_your_preferred_accent_c'
  | 'auto_teacher_profile'
  | 'auto_manage_personal_details_worki'
  | 'auto_edit_profile'
  | 'auto_weekly_working_hours'
  | 'auto_sat'
  | 'auto_sun'
  | 'auto_mon'
  | 'auto_tue'
  | 'auto_wed'
  | 'auto_thu'
  | 'auto_fri'
  | 'auto_reminder_settings'
  | 'auto_in_app_lesson_alerts_within_3'
  | 'auto_browser_push_notifications'
  | 'auto_payment_information'
  | 'auto_information_used_when_sending'
  | 'auto_direct_electronic_payment_prof'
  | 'auto_copy_payment_info'
  | 'auto_parent_message_templates'
  | 'auto_manage_templates_for_homework'
  | 'auto_absence'
  | 'auto_exam_reports'
  | 'auto_lesson_summary'
  | 'auto_message_template_text_arabic'
  | 'auto_available_dynamic_placeholders'
  | 'auto_reset_to_default'
  | 'auto_save_templates'
  | 'auto_inspiration_gratitude'
  | 'auto_teacher_reminders_motivation'
  | 'auto_display_settings'
  | 'auto_frequency'
  | 'auto_once_daily'
  | 'auto_before_first_lesson'
  | 'auto_randomly_during_day'
  | 'auto_display_method'
  | 'auto_in_app_only_card'
  | 'auto_system_notification_only'
  | 'auto_in_app_notification'
  | 'auto_message_source'
  | 'auto_all_messages'
  | 'auto_favorites_only'
  | 'auto_test_reminder_now'
  | 'auto_messages'
  | 'auto_manage_the_motivational_quotes'
  | 'auto_manage_messages'
  | 'auto_all'
  | 'auto_favorites'
  | 'auto_add_message'
  | 'auto_restore_default_messages'
  | 'auto_custom'
  | 'auto_are_you_sure'
  | 'auto_no_messages_found'
  | 'auto_edit_message'
  | 'auto_add_new_message'
  | 'auto_write_your_message'
  | 'auto_restore_defaults'
  | 'auto_default_messages_will_be_resto'
  | 'auto_restore'
  | 'auto_backup_data_management_cente'
  | 'auto_create_full_backups_password'
  | 'auto_smart_data_validation_health'
  | 'auto_inspect_record_consistency_de'
  | 'auto_open_data_audit_health_repor'
  | 'auto_danger_zone_data_reset'
  | 'auto_sensitive_actions_resetting_d'
  | 'auto_application_details_features'
  | 'auto_german_teacher_management_syst'
  | 'auto_description'
  | 'auto_features'
  | 'auto_developer'
  | 'auto_please_select_at_least_one_cat'
  | 'auto_gathering_and_preparing_backup'
  | 'auto_encrypting_payload_with_passwo'
  | 'auto_backup_file_created_and_down'
  | 'auto_quick_backup_created_and_sav'
  | 'auto_backup_failed'
  | 'auto_all_data_restored_successful'
  | 'auto_failed_to_restore_data_plea'
  | 'auto_incorrect_password_or_corrupte'
  | 'auto_selected_categories_restored'
  | 'auto_rollback_successful_restore'
  | 'auto_smart_backup_restore_center'
  | 'auto_professional_data_management'
  | 'auto_undo_last_restore'
  | 'auto_undo_last_restore_18'
  | 'auto_1_tap_backup'
  | 'auto_custom_export'
  | 'auto_custom_restore'
  | 'auto_auto_backups'
  | 'auto_restore_history'
  | 'auto_instant_1_click_backup'
  | 'auto_export_and_save_a_complete_bac'
  | 'auto_saving_and_sharing'
  | 'auto_tap_to_backup_save_everythin'
  | 'auto_instant_1_click_restore'
  | 'auto_select_a_backup_json_file_you'
  | 'auto_restoring_all_data'
  | 'auto_choose_file_restore_all'
  | 'auto_automatic_data_protection'
  | 'auto_before_performing_any_restore'
  | 'auto_select_all'
  | 'auto_deselect_all'
  | 'auto_full_backup_selected_100'
  | 'auto_partial_selection_selectedc'
  | 'auto_full_backup_preview'
  | 'auto_partial_backup_preview'
  | 'auto_payload_details_and_estimated'
  | 'auto_total_records'
  | 'auto_groups'
  | 'auto_estimated_size'
  | 'auto_estimated_time'
  | 'auto_password_protect_encrypt_bac'
  | 'auto_enter_encryption_password'
  | 'auto_this_password_will_be_required'
  | 'auto_creating_backup_file'
  | 'auto_download_full_backup_json'
  | 'auto_download_partial_backup_sel'
  | 'auto_select_or_drop_backup_file_js'
  | 'auto_supports_standard_and_password'
  | 'auto_browse_json_file'
  | 'auto_this_backup_file_is_password_p'
  | 'auto_enter_password_to_unlock'
  | 'auto_unlock'
  | 'auto_backup_type_analysis_backup'
  | 'auto_verified_structure'
  | 'auto_restore_mode'
  | 'auto_smart_restore_default'
  | 'auto_detect_duplicates_update_exis'
  | 'auto_merge_mode'
  | 'auto_keep_current_data_add_importe'
  | 'auto_replace_mode'
  | 'auto_replace_current_data_with_impo'
  | 'auto_categories_to_restore'
  | 'auto_select_all_available'
  | 'auto_restore_impact_report'
  | 'auto_records_to_add'
  | 'auto_records_to_update'
  | 'auto_duplicates_detected'
  | 'auto_potential_conflicts'
  | 'auto_creating_restore_point_apply'
  | 'auto_warning_replace_mode_will_ove'
  | 'auto_an_automatic_restore_point_sna'
  | 'auto_confirm_replace_restore'
  | 'auto_restore_everything'
  | 'auto_restore_selected_categories'
  | 'auto_automatic_backup_retention_s'
  | 'auto_schedule_periodic_background_s'
  | 'auto_daily_automatic_backup'
  | 'auto_capture_a_daily_data_snapshot'
  | 'auto_weekly_automatic_backup'
  | 'auto_capture_a_weekly_snapshot_auto'
  | 'auto_monthly_automatic_backup'
  | 'auto_capture_a_monthly_snapshot_for'
  | 'auto_backup_retention_policy'
  | 'auto_keep_last_cnt'
  | 'auto_restore_operation_history'
  | 'auto_chronological_audit_log_of_all'
  | 'auto_no_restore_history_logged_yet'
  | 'auto_student_smart_card'
  | 'auto_active_19'
  | 'auto_archived'
  | 'auto_bearbeiten'
  | 'auto_l_schen'
  | 'auto_call_parent'
  | 'auto_call_student'
  | 'auto_overview'
  | 'auto_attendance_presentcount_l'
  | 'auto_grades_homework'
  | 'auto_files_student_documents_len'
  | 'auto_allgemeine_informationen'
  | 'auto_import_group_students'
  | 'auto_no_students_yet'
  | 'auto_add_your_first_student_to_trac'
  | 'auto_parent'
  | 'auto_student_20'
  | 'auto_options'
  | 'auto_view_profile'
  | 'auto_check_attendance'
  | 'auto_scores_homework'
  | 'auto_payment_history'
  | 'auto_send_whatsapp'
  | 'auto_call_phone'
  | 'auto_delete_archive'
  | 'auto_no_groups_yet'
  | 'auto_create_your_first_group_to_sta'
  | 'auto_view_details'
  | 'auto_online'
  | 'auto_center'
  | 'auto_home'
  | 'auto_private'
  | 'auto_in_person'
  | 'auto_lesson'
  | 'alert_add_zoom_link'
  | 'alert_no_parent_phone'
  | 'alert_finish_lesson_first'
  | 'zoom_saved'
  | 'zoom_save_group'
  | 'message_preview'
  | 'restore_original_text'
  | 'setup_subtitle'
  | 'setup_description'
  | 'settings_live_preview'
  | 'settings_primary_button'
  | 'settings_secondary_button'
  | 'settings_premium_widget'
  | 'settings_adapts_accent'
  | 'student_sitzungen'
  | 'student_anwesend'
  | 'student_paketzyklus'
  | 'student_doc_homework'
  | 'student_doc_exam'
  | 'student_doc_general'
  | 'student_notizen';

export const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  ar: {
    notifications_title: 'الإشعارات',
    free_time_available_today: 'الأوقات المتاحة اليوم',
    nav_home: 'الرئيسية',
    nav_schedule: 'الجدول',
    nav_students: 'الطلاب',
    nav_history: 'السجل',
    nav_payments: 'المدفوعات',
    nav_reports: 'التقارير',
    nav_settings: 'الإعدادات',
    nav_quickLesson: 'حصة سريعة',
    nav_more: 'المزيد',
    nav_widgets: 'ويدجت أندرويد',
    goodMorning: 'صباح الخير',
    goodAfternoon: 'مساء الخير',
    goodEvening: 'مساء الخير',
    greeting: 'مرحباً بك',
    refreshData: 'تحديث البيانات',
    dataRefreshed: 'تم تحديث البيانات بنجاح',
    upcomingLessonAlert: 'حصة قريبة',
    open: 'فتح',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    search: 'بحث',
    all: 'الكل',
    filter: 'تصفية',
    status: 'الحالة',
    date: 'التاريخ',
    time: 'الوقت',
    notes: 'الملاحظات',
    confirm: 'تأكيد',
    back: 'رجوع',
    close: 'إغلاق',
    actions: 'الإجراءات',
    copied: 'تم النسخ',
    yes: 'نعم',
    no: 'لا',
    archive: 'أرشيف',
    status_completed: 'مكتملة',
    status_cancelled: 'ملغاة',
    status_upcoming: 'قادمة',
    status_in_progress: 'جارية',
    status_pending: 'معلقة',
    status_scheduled: 'مجدولة',
    att_present: 'حاضر',
    att_absent: 'غائب',
    att_late: 'متأخر',
    hw_assigned: 'مطلوب',
    hw_completed: 'مكتمل',
    hw_not_completed: 'غير مكتمل',
    settings_title: 'الإعدادات والحساب',
    settings_sub: 'إدارة الحساب والمظهر والنسخ الاحتياطي',
    settings_language: 'لغة الواجهة',
    settings_lang_desc: 'اختر اللغة المستخدمة في واجهة التطبيق',
    settings_parent_comm_notice: 'ملاحظة: تقارير ورسائل أولياء الأمور تُصاغ دائماً باللغة العربية.',
    settings_theme: 'المظهر',
    settings_theme_light: 'الوضع الفاتح',
    settings_theme_dark: 'الوضع الداكن',
    settings_profile: 'بيانات المعلم',
    settings_name: 'اسم المعلم',
    settings_email: 'البريد الإلكتروني',
    settings_currency: 'العملة',
    settings_working_hours: 'ساعات العمل',
    settings_start_time: 'بداية اليوم',
    settings_end_time: 'نهاية اليوم',
    settings_payment_details: 'بيانات التحويل والدفع',
    settings_phone: 'رقم الهاتف',
    settings_instapay: 'حساب انستا باي',
    settings_vodafone: 'فودافون كاش',
    settings_bank: 'الحساب البنكي',
    settings_payment_link: 'رابط الدفع',
    settings_share_payment: 'نسخ بيانات التحويل',
    settings_backup: 'النسخ الاحتياطي والاستعادة',
    settings_download_backup: 'تحميل نسخة احتياطية',
    settings_restore_backup: 'استعادة من ملف',
    settings_clear_data: 'مسح جميع البيانات',
    settings_save_success: 'تم حفظ التغييرات بنجاح',
    schedule_title: 'جدول الحصص',
    schedule_today: 'اليوم',
    schedule_week: 'الأسبوع',
    schedule_month: 'الشهر',
    schedule_add_lesson: 'إضافة حصة',
    schedule_start_now: 'بدء حصة الآن',
    schedule_no_lessons: 'لا توجد حصص مجدولة',
    schedule_conflict: 'تعارض',
    schedule_working_hours: 'ساعات العمل',
    schedule_refresh: 'تحديث',
    schedule_ical: 'تصدير التقويم',
    schedule_no_conflicts: 'لا توجد تعارضات زمنية',
    schedule_day_view: 'عرض اليوم',
    schedule_week_view: 'عرض الأسبوع',
    schedule_month_view: 'عرض الشهر',
    schedule_reschedule: 'تغيير الموعد',
    schedule_new_date: 'التاريخ الجديد',
    schedule_new_time: 'الوقت الجديد',
    schedule_conflict_alert: 'تنبيه: يوجد تعارض في هذا الموعد',
    schedule_reschedule_success: 'تم تغيير الموعد بنجاح',
    schedule_weekly: 'أسبوعياً',
    schedule_no_lessons_day: 'لا توجد حصص مجدولة لهذا اليوم',
    schedule_add_lesson_for: 'إضافة حصة جديدة',
    lesson_control_title: 'إدارة الحصة',
    lesson_timer: 'مؤقت الحصة المباشر',
    lesson_duration: 'المدة',
    lesson_start: 'بدء الحصة',
    lesson_resume: 'استئناف الحصة',
    lesson_pause: 'إيقاف مؤقت',
    lesson_end: 'إنهاء الحصة',
    lesson_cancel: 'إلغاء الحصة',
    lesson_report_form: 'تقرير الحصة',
    lesson_show_timer: 'إظهار المؤقت',
    lesson_attendance: 'الحضور والغياب',
    lesson_homework: 'الواجب المدرسي',
    lesson_teacher_notes: 'ملاحظات المعلم',
    lesson_parent_report_btn: 'تقرير ولي الأمر',
    lesson_save_report: 'حفظ التقرير',
    students_title: 'الطلاب والمجموعات',
    students_tab_all: 'جميع الطلاب',
    students_tab_groups: 'المجموعات',
    students_add_student: '+ طالب',
    students_add_group: '+ مجموعة',
    students_search_placeholder: 'بحث باسم الطالب، ولي الأمر، أو الهاتف...',
    students_search_group_placeholder: 'البحث عن مجموعة...',
    students_group_name: 'اسم المجموعة',
    students_student_name: 'اسم الطالب',
    students_grade: 'الصف الدراسي',
    students_parent_phone: 'هاتف ولي الأمر',
    students_student_phone: 'هاتف الطالب',
    students_package: 'الباقة',
    students_no_students: 'لا يوجد طلاب بعد',
    students_no_groups: 'لا توجد مجموعات بعد',
    students_group: 'مجموعة',
    students_individual: 'فردي',
    students_active: 'نشط',
    students_archived: 'مؤرشف',
    students_lessons_count: 'عدد الحصص',
    students_phone: 'الهاتف',
    students_parent_phone_label: 'ولي الأمر',
    students_details: 'التفاصيل',
    students_all_grades: 'جميع الصفوف',
    students_no_students_found: 'لم يتم العثور على طلاب.',
    students_all_days: 'كل الأيام',
    students_today: 'اليوم',
    students_archive_info: 'الطلاب والمجموعات المؤرشفة تظل محفوظة في السجل ويمكن إعادة تنشيطها في أي وقت.',
    students_archived_students_title: 'الطلاب المؤرشفون',
    students_no_archived_students: 'لا يوجد طلاب مؤرشفون.',
    students_archived_groups_title: 'المجموعات المؤرشفة',
    students_no_archived_groups: 'لا توجد مجموعات مؤرشفة.',
    students_restore: 'استعادة',
    students_reset_filters: 'إعادة ضبط الفلاتر',
    history_title: 'سجل الحصص',
    history_header_sub: 'عرض وإدارة أرشيف جميع الحصص والتقارير السابقة',
    history_total_lessons: 'إجمالي الحصص',
    history_completed: 'مكتملة',
    history_cancelled_missed: 'ملغاة/غائب',
    history_total_hours: 'إجمالي الساعات',
    history_filter_all: 'الكل',
    history_filter_completed: 'مكتملة',
    history_filter_cancelled: 'ملغاة',
    history_filter_pending: 'معلقة',
    history_search_placeholder: 'بحث باسم الطالب، المجموعة، أو موضوع الحصة...',
    history_search: 'بحث في السجل',
    history_export: 'تصدير السجل',
    history_filter_entity_label: 'تصفية حسب الطالب/المجموعة:',
    history_all_entities: 'كل الطلاب والمجموعات',
    history_groups_category: 'المجموعات',
    history_students_category: 'الطلاب',
    history_filter_period_label: 'الفترة الزمنية:',
    history_period_all: 'كل الأوقات',
    history_period_today: 'اليوم',
    history_period_this_week: 'هذا الأسبوع',
    history_period_this_month: 'هذا الشهر',
    history_results_count: 'نتائج السجل ({count} حصة)',
    history_reset_filters: 'إعادة ضبط الفلاتر',
    payments_title: 'إدارة المدفوعات',
    payments_total_collected: 'المحصل',
    payments_total_pending: 'المتبقي',
    payments_completed_cycle: 'الدورة اكتملت',
    payments_daily_summary: 'ملخص اليوم',
    payments_details_heading: 'التفاصيل',
    payments_due_tab: 'المستحقات',
    payments_history_sub: 'تاريخ سداد المدفوعات',
    payments_monthly_summary: 'ملخص الشهر',
    payments_no_cycles_period: 'لا توجد دورات مسددة',
    payments_no_due_sub: 'لا توجد مستحقات سداد حاليا',
    payments_not_yet_btn: 'لم يتم السداد',
    payments_paid_btn: 'تم السداد',
    payments_parent_notice: 'إشعار لولي الأمر',
    payments_pending_tag: 'في الانتظار',
    payments_weekly_summary: 'ملخص الأسبوع',
    payments_daily_gain: 'أرباح اليوم',
    payments_weekly_gain: 'أرباح الأسبوع',
    payments_monthly_gain: 'أرباح الشهر',
    payments_overdue: 'متأخر',
    payments_expected: 'المتوقع',
    payments_revenue_overview: 'نظرة عامة على الإيرادات',
    payments_record: 'تسجيل دفعة',
    payments_send_reminder: 'تذكير بالدفع',
    payments_paid: 'مدفوع',
    payments_unpaid: 'غير مدفوع',
    payments_partial: 'جزئي',
    payments_collected: 'تم تحصيله',
    payments_pending: 'في الانتظار',
    payments_plan: 'خطة الدفع',
    payments_history: 'سجل المدفوعات',
    payments_method: 'طريقة الدفع',
    payments_due_date: 'تاريخ الاستحقاق',
    payments_daily: 'يومياً:',
    payments_weekly: 'أسبوعياً:',
    payments_monthly: 'شهرياً:',
    payments_total_pending_label: 'إجمالي المستحقات',
    payments_open_tab: 'المستحقات المفتوحة',
    payments_history_tab: 'سجل المدفوعات',
    payments_all_groups: 'كل المجموعات',
    payments_no_due_title: 'لا توجد مستحقات سداد حالياً ✨',
    payments_no_due_desc: 'جميع الطلاب مسددون حتى الآن. يظهر الطلاب هنا تلقائياً فقط بعد اكتمال دورتهم الدراسية (مثل 4/4 أو 8/8 حصص).',
    payments_completed_dates_label: 'مواعيد الحصص المكتملة في هذا التنسيق:',
    payments_pending_expectation: '(قيد الانتظار ⏳)',
    payments_amount_due: 'المبلغ المستحق',
    payments_mark_paid: 'تم السداد (Paid)',
    payments_mark_not_yet: 'لم يتم بعد (Not Yet)',
    payments_notify_parent_wa: 'إشعار الوالد (WhatsApp)',
    payments_no_history: 'لا توجد مدفوعات سابقة مؤرشفة',
    payments_history_auto_archive: 'الدورات المسددة تتأرشف هنا تلقائياً.',
    payments_paid_on: 'تاريخ السداد:',
    payments_notice_title: 'إشعار سداد للوالد',
    payments_copy_text: 'نسخ النص',
    payments_copied: 'تم النسخ! ✓',
    payments_open_whatsapp: 'فتح WhatsApp',
    payments_daily_gain_title: 'أرباح اليوم (اليوم)',
    payments_weekly_gain_title: 'أرباح الأسبوع (آخر 7 أيام)',
    payments_monthly_gain_title: 'أرباح الشهر (هذا الشهر)',
    payments_gain_summary_sub: 'ملخص الإيرادات والدورات المسددة',
    payments_total_gains: 'إجمالي الإيرادات',
    payments_paid_cycles: 'الدورات المسددة',
    payments_details_header: 'تفاصيل المدفوعات',
    payments_no_paid_period: 'لم يتم تسجيل دورات مسددة في هذه الفترة.',
    reports_title: 'التقارير والتحليلات',
    reports_header_sub: 'الحصص، الإيرادات الأسبوعية، ومتابعة المدفوعات',
    reports_print_pdf: 'طباعة / PDF',
    reports_collected_revenue: 'الإيرادات المحصلة',
    reports_from_paid_sessions: 'محصلة من الحصص',
    reports_unpaid_amount: 'المبلغ المتبقي',
    reports_pending_payments: 'مدفوعات قيد الانتظار',
    reports_sessions_completed: 'الحصص المكتملة',
    reports_total_conducted: 'إجمالي ما تم تنفيذه',
    reports_unpaid_last_sessions: 'حصص ختامية غير مسددة',
    reports_urgent_collect: '⚠️ تحصيل عاجل!',
    reports_all_good: 'كل شيء ممتاز',
    reports_weekly_protocol: 'سجل الحصص والإيرادات الأسبوعي',
    reports_weekly_protocol_sub: 'كل حصة مع الرسوم المحصلة وتنبيهات الدفع',
    reports_filter_all: 'الكل',
    reports_filter_this_week: 'هذا الأسبوع',
    reports_filter_paid: 'مدفوع',
    reports_filter_unpaid: 'غير مدفوع',
    reports_no_sessions_filter: 'لم يتم العثور على حصص للمرشح المحدد.',
    reports_weekly_chart_title: 'مقارنة المبيعات الأسبوعية',
    reports_attendance_overview_title: 'ملخص حضور الطلاب',
    reports_total_lessons: 'إجمالي الحصص',
    reports_active_students: 'الطلاب النشطون',
    reports_attendance_rate: 'نسبة الحضور',
    reports_lessons_completed: 'الحصص المكتملة',
    reports_revenue: 'الإيرادات',
    reports_students: 'عدد الطلاب',
    reports_export_pdf: 'تصدير تقرير PDF',
    daily_stats_lessons_today: 'حصص اليوم',
    daily_stats_students_today: 'طلاب اليوم',
    daily_stats_revenue_today: 'دخل اليوم',
    daily_stats_completed: 'المكتملة',
    daily_stats_monthly_overview: 'ملخص الشهر',
    daily_stats_students: 'الطلاب',
    daily_stats_groups: 'المجموعات',
    daily_stats_completed_short: 'المكتملة',
    daily_stats_revenue: 'الإيرادات',
    tomorrows_lessons_title: 'حصص الغد',
    no_lessons_tomorrow: 'لا توجد حصص مجدولة لغداً ✨',
    weekly_overview_title: 'المعاينة الأسبوعية',
    weekly_overview_sub: 'الجمعة - الخميس',
    stat_remaining: 'المتبقية',
    stat_cancelled: 'الملغاة',
    stat_uncollected: 'غير محصلة',
    stat_total_expected: 'الإجمالي المتوقع',
    smart_summary_title: 'ملخص اليوم الذكي',
    smart_summary_badge: 'تحديث ذكي',
    smart_summary_today: 'اليوم',
    smart_summary_expected_income: 'متوقع تحصيله',
    smart_summary_first_lesson: 'أول حصة',
    smart_summary_overdue_students: 'طلاب متأخرون',
    smart_summary_todays_lessons: 'حصص اليوم',
    smart_summary_todays_students: 'طلاب اليوم',
    smart_summary_no_lessons_regular: 'لا توجد حصص مجدولة لليوم. جميع الدفوعات منتظمة بالكامل ✨',
    next_action_title: 'الحصة القادمة',
    next_action_no_lessons: 'لا توجد حصص قادمة للمرشح المحدد',
    next_action_today: 'اليوم',
    next_action_tomorrow: 'غداً',
    next_action_this_week: 'هذا الأسبوع',
    next_action_all: 'الكل',
    next_action_online: 'أونلاين',
    next_action_offline: 'حضوري',
    next_action_open: 'فتح الحصة',
    time_in_progress: 'جارية الآن',
    time_starts_in: 'تبدأ قريباً',
    time_starts_at: 'تبدأ الساعة',
    time_scheduled_today: 'مجدولة اليوم',
    timeline_title: 'جدول حصص اليوم',
    todays_lessons_title: 'حصص اليوم',
    timeline_pending_action: 'الحصص السابقة المعلقة',
    past_pending_lessons_title: 'الحصص السابقة المعلقة (Past Pending Lessons)',
    past_pending_lessons_desc: 'حصص سابقة لم تتلق حالة نهائية بعد (مكتملة أو ملغاة):',
    timeline_requires_action: 'تتطلب إجراء',
    timeline_pending_desc: 'هذه الحصص السابقة لم تُستكمل بعد:',
    timeline_no_lessons: 'لا توجد حصص مجدولة اليوم',
    timeline_completed_of: 'حصص مكتملة',
    timeline_live_now: 'مباشر الآن',
    timeline_upcoming: 'قادمة',
    timeline_group: 'مجموعة',
    timeline_individual: 'فردي',
    system_time: 'وقت النظام',
    sofort_badge: 'بدء حصة فورية',
    sofort_title: 'بدء حصة الآن (في أي وقت)',
    sofort_desc: 'بدء حصة فورية لأي مجموعة، بغض النظر عن الجدول الزمني.',
    quick_lesson_modal_title: 'حصة سريعة',
    quick_lesson_modal_desc: 'للحصص التجريبية أو الطلاب بدون ملف شخصي',
    students_and_groups_title: 'الطلاب والمجموعات',
    session_history_modal_title: 'سجل الحصص',
    daily_gain_label: 'يومياً:',
    weekly_gain_label: 'أسبوعياً:',
    monthly_gain_label: 'شهرياً:',
    open_payments_tab: 'المستحقات المفتوحة',
    payment_history_tab: 'سجل المدفوعات',
    all_groups_option: 'كل المجموعات',
    no_due_payments_title: 'لا توجد مستحقات سداد حالياً ✨',
    no_due_payments_desc: 'جميع الطلاب مسددون حتى الآن. يظهر الطلاب هنا تلقائياً فقط بعد اكتمال دورتهم الدراسية (مثل 4/4 أو 8/8 حصص).',
    dismiss_from_dashboard: 'إخفاء من اللوحة الرئيسية',
    todo_widget_title: 'قائمة المهام السريعة',
    todo_add_placeholder: 'اكتب مهمة جديدة...',
    todo_no_tasks: 'لا توجد مهام معلقة ✨',
    todo_add_btn: 'إضافة',
    reports_and_analytics_title: 'التقارير والتحليلات',
    nav_free_time: 'الأوقات المتاحة',
    add_group_title: 'إضافة مجموعة جديدة',
    add_group_subtitle: 'أدخل تفاصيل المجموعة والباقة الشهرية',
    lesson_duration_label: 'مدة الحصة',
    schedule_lesson_title: 'جدولة حصة جديدة',
    save_lesson_btn: 'حفظ الحصة',
    duplicate_student_warning: 'طالب بنفس الاسم موجود بالفعل في هذه المجموعة. هل تريد المتابعة؟',
    students_all_groups: 'جميع المجموعات',
    payments_no_due: 'لا توجد مستحقات سداد حالياً',
    payment_plan_lessons: 'حصص',
    payments_completed_dates: 'مواعيد الحصص المكتملة',
    reports_copied: 'تم نسخ التقرير',
    reports_and_analyses: 'التقارير والتحليلات',
    lesson_session_num: 'رقم الحصة',
    daily_stats_student: 'الطالب',
    todo_more_tasks: 'مهام إضافية...',
  
    auto_please_enter_student_name: "يرجى إدخال اسم الطالب",
    auto_parent_phone_number_is_require: "رقم هاتف ولي الأمر مطلوب للطالب",
    auto_import_group_students_with_a: "استيراد مجموعة + طلاب بالذكاء الاصطناعي",
    auto_create_group_and_all_students: "أنشئ المجموعة والطلاب دفعة واحدة بنص جاهز",
    auto_ai_import: "تجربة الاستيراد",
    auto_create_a_student_for_this_grou: "إنشاء طالب مع هذه المجموعة (درس خصوصي 1 لـ 1)",
    auto_initial_student_information: "بيانات الطالب الأولية",
    auto_student_name: "اسم الطالب *",
    auto_e_g_ahmed_ali: "مثال: أحمد علي",
    auto_parent_name: "اسم ولي الأمر",
    auto_e_g_ali_mahmoud: "مثال: علي محمود",
    auto_parent_phone: "هاتف ولي الأمر",
    auto_grade: "المرحلة الدراسية",
    auto_student_notes: "ملاحظات الطالب",
    auto_additional_student_notes: "ملاحظات إضافية حول الطالب...",
    auto_save_group: "حفظ المجموعة",
    auto_parent_phone_number_is_require_1: "رقم هاتف ولي الأمر مطلوب إجبارياً",
    auto_add_new_student: "إضافة طالب جديد",
    auto_automatic_group_pricing_inheri: "توريث تسعير المجموعة تلقائياً",
    auto_assigned_group: "تعيين المجموعة / الدورة *",
    auto_inherited_pricing: "الأسعار الموروثة تلقائياً:",
    auto_package: "الباقة: ",
    auto_sessions: "حصص",
    auto_inherited_automatically_from: " يتم التوريث تلقائياً من ${selectedGroup.name}.",
    auto_grade_level: "المرحلة الدراسية",
    auto_parent_phone_2: "هاتف ولي الأمر *",
    auto_student_phone_optional: "هاتف الطالب (اختياري)",
    auto_special_focus_notes_or_weakn: "ملاحظات إضافية حول الطالب...",
    auto_save_student: "حفظ الطالب",
    auto_import_group_students_ai_te: "استيراد مجموعة + طلاب (AI Import)",
    auto_create_an_entire_group_and_all: "أنشئ المجموعة وجميع الطلاب دفعة واحدة بنص ذكي",
    auto_group_students_imported_succ: "تم استيراد المجموعة والطلاب بنجاح!",
    auto_group_name: "اسم المجموعة:",
    auto_grade_level_3: "الصف / المرحلة:",
    auto_students_imported: "عدد الطلاب:",
    auto_students: "الطلاب",
    auto_schedule: "المواعيد:",
    auto_view_group_profile: "فتح ملف المجموعة",
    auto_close: "إغلاق",
    auto_copy_prompt_orders_for_ai: "أوامر للذكاء الاصطناعي (AI Prompt Orders)",
    auto_prompt_copied: "تم نسخ الأوامر!",
    auto_copy_ai_prompt_orders: "نسخ أوامر ChatGPT / Gemini",
    auto_copied: "تم النسخ!",
    auto_sample_data: "تجربة نموذج جاهز",
    auto_click_copy_ai_prompt_orders: "اضغط على \"نسخ أوامر ChatGPT / Gemini\" والصقها في برنامج الذكاء الاصطناعي مع قائمة أسماء طلابك وملاحظات المجموعة، ثم انسخ الرد والصقه في الصندوق بالأسفل مباشرة.",
    auto_ai_generated_text: "النص المستورد من الذكاء الاصطناعي:",
    auto_strict_zero_data_loss_validati: "يدعم التحقق الفوري بدون أخطاء",
    auto_all_fields_validated_success: "✓ البيانات سليمة 100% ومجهزة للاستيراد الآمن",
    auto_data_preview_before_import: "معاينة البيانات قبل الاعتماد:",
    auto_students_4: "طلاب",
    auto_group_name_5: "اسم المجموعة",
    auto_grade_type: "الصف والنوع",
    auto_days_time: "المواعيد",
    auto_zoom_link: "رابط زووم",
    auto_address: "العنوان / المكان",
    auto_student_name_6: "اسم الطالب",
    auto_parent_phone_req: "هاتف ولي الأمر (مطلوب)",
    auto_student_phone_opt: "هاتف الطالب (اختياري)",
    auto_cancel: "إلغاء",
    auto_confirm_import: "تأكيد الاستيراد (Confirm Import)",
    auto_share_session_report: "مشاركة تقرير الحصة",
    auto_bulk_group_report_groups: "📊 تقرير مجمع للمجموعة (${groupStudents.length} طلاب)",
    auto_individual_student_report: "👤 تقرير فردي لكل طالب",
    auto_select_a_student_to_preview: "👥 اختر طالب لمعاينة تقريره الفردي:",
    auto_student: "👤 الطالب:",
    auto_not_specified: "غير محدد",
    auto_parent_phone_7: "📱 رقم ولي الأمر:",
    auto_not_registered: "غير مسجل",
    auto_group: "👥 مجموعة:",
    auto_german_group: "مجموعة اللغة الألمانية",
    auto_whatsapp_group_connected: "جروب الواتساب متصل ✅",
    auto_group_link_not_linked_yet: "⚠️ لم يتم ربط رابط الجروب بعد",
    auto_tip_you_can_edit_the_group_to: "نصيحة: يمكنك تعديل المجموعة لإدخال \"رابط جروب الواتساب\" الخاص بأولياء الأمور لتتمكن من إرسال هذا التقرير المجمع للجروب بنقرة واحدة!",
    auto_preview_edit_message: "معاينة وتعديل نص الرسالة:",
    auto_copy_text: "نسخ النص",
    auto_send_to_whatsapp_group: "إرسال لجروب الواتساب",
    auto_send_via_whatsapp: "إرسال عبر واتساب",
    auto_print: "طباعة",
    auto_phone_call: "اتصال هاتفى",
    auto_go_to_homescreen: "الرئيسية",
    auto_free_hours: "ساعات فارغة",
    auto_slots: "فترات (١س)",
    auto_next_slot: "التالي",
    auto_none: "لا يوجد",
    auto_excellent: "🟢 ممتاز",
    auto_needs_cleanup: "🟡 يحتاج تنظيف",
    auto_critical: "🔴 حرج",
    auto_students_without_group: "طلاب بدون مجموعة",
    auto_sessions_without_group: "حصص بدون مجموعة",
    auto_calendar_sessions_without_grou: "أحداث تقويم بدون مجموعة",
    auto_payments_without_group: "مدفوعات بدون مجموعة",
    auto_attendance_records_without_gro: "سجلات حضور بدون مجموعة",
    auto_homework_records_without_group: "سجلات واجبات بدون مجموعة",
    auto_exam_records_without_group: "سجلات اختبارات بدون مجموعة",
    auto_data_health_center: "مركز صحة البيانات والتنظيف",
    auto_last_scan_lastscantime: "آخر فحص: ${lastScanTime}",
    auto_scan_database: "فحص قاعدة البيانات",
    auto_data_health_summary: "ملخص صحة البيانات",
    auto_database_health_score: "مؤشر السلامة",
    auto_healthy_records: "سجلات سليمة",
    auto_orphaned_records: "سجلات معزولة",
    auto_storage_used: "المساحة",
    auto_clean_all_orphan_data: "تنظيف كافة البيانات المعزولة الآن",
    auto_data_integrity_cleanup: "سلامة البيانات والتنظيف",
    auto_detect_unlinked_orphaned_data: "الكشف عن البيانات غير المرتبطة بمجموعات",
    auto_1_students_without_group: "1. طلاب بدون مجموعة",
    auto_student_records_whose_groupid: "سجلات الطلاب التي تفتقد groupId أو تشير إلى مجموعة محذوفة.",
    auto_2_sessions_without_group: "2. حصص بدون مجموعة",
    auto_lesson_sessions_whose_groupid: "سجلات الحصص المنفذة والتاريخية غير المرتبطة بمجموعة صحيحة.",
    auto_3_calendar_sessions_without_g: "3. أحداث تقويم بدون مجموعة",
    auto_calendar_events_whose_groupid: "أحداث المواعيد المجدولة في التقويم غير المرتبطة بمجموعة مفعّلة.",
    auto_4_payments_without_group: "4. مدفوعات بدون مجموعة",
    auto_payment_records_linked_to_miss: "سجلات المعاملات والرسوم المالية المرتبطة بمجموعات محذوفة.",
    auto_5_attendance_records_without: "5. سجلات حضور بدون مجموعة",
    auto_attendance_records_linked_to_m: "سجلات كشوف الحضور والغياب لل حصص غير المرتبطة بمجموعة.",
    auto_6_homework_records_without_gr: "6. سجلات واجبات بدون مجموعة",
    auto_homework_records_linked_to_mis: "بيانات متابعة الواجبات المنزلية المرتبطة بمجموعات ملغاة.",
    auto_7_exam_quiz_records_without_g: "7. سجلات اختبارات بدون مجموعة",
    auto_exam_results_linked_to_missing: "درجات الامتحانات والاختبارات القصيرة المرتبطة بمجموعات غير موجودة.",
    auto_profile_field_integrity: "اكتمل الملف والتفاصيل",
    auto_students_with_complete_data: "طالب مكتمل البيانات",
    auto_students_missing_parent_phone: "طلاب بدون رقم ولي أمر",
    auto_fix_now: "إصلاح",
    auto_groups_missing_schedule: "جروب بدون جدول زمني",
    auto_groups_missing_session_price: "جروب بدون سعر حصة",
    auto_online_groups_missing_zoom_lin: "جروب أونلاين بدون رابط زووم",
    auto_offline_groups_missing_locatio: "جروب أوفلاين بدون عنوان المكان",
    auto_total_orphaned_records_getc: "إجمالي السجلات المعزولة: ${getCategoryCount(viewCategory)}",
    auto_no_orphaned_records_in_this_ca: "لا توجد سجلات معزولة في هذه الفئة!",
    auto_delete_all_in_category: "حذف الكل لهذا القسم",
    auto_cleanup_orphan_data: "⚠️ تنظيف البيانات المعزولة",
    auto_the_selected_records_are_not_l: "السجلات المحددة غير مرتبطة بأي مجموعة حالية أو تم إلغاء مجموعتها.",
    auto_records_to_delete_singledel: "السجلات المراد حذفها: ${singleDeleteItemId ? 1 : confirmDeleteTarget === 'all' ? totalOrphanedRecords : getCategoryCount(confirmDeleteTarget)}",
    auto_this_action_cannot_be_undone: "هذا الإجراء نهائي ولا يمكن التراجع عنه.",
    auto_delete_permanently: "حذف نهائياً",
    auto_cleanup_complete: "اكتمل التنظيف بنجاح",
    auto_dashboard_views_automaticall: "تم تحديث الشاشات والقواعد تلقائياً",
    auto_deleted_records_breakdown: "السجلات التي تم حذفها:",
    auto_sessions_8: "الحصص",
    auto_calendar_events: "أحداث التقويم",
    auto_payments: "Zahlungen",
    auto_attendance: "سجلات الحضور",
    auto_homework: "سجلات الواجبات",
    auto_exams: "الاختبارات",
    auto_storage_recovered_cleanupre: "المساحة المستردة: ${cleanupResults.storageRecoveredMb} MB",
    auto_done: "تم العودة للتطوير",
    auto_view: "عرض",
    auto_delete_all: "حذف الكل",
    auto_delete_this_record: "حذف هذا السجل فقط",
    auto_zoom_link_is_required_for_onli: "رابط زووم مطلوب للمجموعات الأونلاين",
    auto_address_location_is_required: "العنوان / المكان مطلوب للمجموعات الأوفلاين",
    auto_refresh_data: "تحديث البيانات",
    auto_daily_inspiration: "إلهام اليوم",
    auto_teacher_reminder_motivation: "تذكير للمعلم وخطوة للبركة",
    auto_another_message: "رسالة أخرى",
    auto_dismiss: "إغلاق",
    auto_quick_review: "ملخص سريع",
    auto_report_saved: "✓ تم حفظ التقرير",
    auto_1_attendance: "١. الحضور",
    auto_present: "✓ حاضر",
    auto_late: "⚠️ متأخر",
    auto_absent: "✕ غائب",
    auto_2_homework: "٢. الواجب",
    auto_completed: "مكتمل",
    auto_assigned: "مطلوب",
    auto_not_completed: "غير مكتمل",
    auto_3_teacher_notes: "٣. ملاحظات المعلم",
    auto_edit_report: "تعديل التقرير",
    auto_before_starting: "قبل بدء الدرس",
    auto_send_lesson_reminder: "إرسال تذكير الحصة",
    auto_open_zoom_link: "فتح رابط زووم",
    auto_open_google_meet: "فتح جوجل ميت",
    auto_send_lesson_started_notice: "إرسال إشعار بدء الحصة",
    auto_send_payment_request: "إرسال مطالبة بالدفع",
    auto_open_google_maps_navigation: "فتح خرائط جوجل",
    auto_live_lesson_timer: "مؤقت الحصة المباشر",
    auto_completed_9: "مكتملة ✅",
    auto_cancelled: "ملغاة ✕",
    auto_in_progress: "جاري التشغيل 🟢",
    auto_paused: "موقوف مؤقتاً ⏸️",
    auto_scheduled: "مجدولة 📅",
    auto_duration_selectedlesson_dur: "المدة: ${selectedLesson.durationMinutes} دقيقة",
    auto_elapsed_time: "الوقت المنقضي",
    auto_start_session: "بدء الحصة (Start)",
    auto_cancel_session: "إلغاء الحصة",
    auto_resume_session: "استئناف الحصة",
    auto_pause: "إيقاف مؤقت",
    auto_confirm_lesson_cancellation: "تأكيد إلغاء الحصة",
    auto_are_you_sure_you_want_to_cance: "هل أنت متأكد من إلغاء هذه الحصة؟ سيتم توثيق السبب وحفظ الحصة كـ ملغاة.",
    auto_enter_cancellation_reason_opt: "أدخل سبب إلغاء الحصة (اختياري)...",
    auto_back: "عودة",
    auto_yes_cancel_lesson: "نعم، إلغاء الحصة",
    auto_unified_session_report: "تقرير الحصة والطلاب الموحد",
    auto_hide_report: "إخفاء التقرير",
    auto_subject_taught_content_less: "ماذا تم في الحصة (المحتوى والدروس المعطاة):",
    auto_enter_topics_taught_new_gramm: "أدخل الموضوعات التي تم شرحها، القواعد الجديدة، والكلمات التي تم تغطيتها في الحصة...",
    auto_next_homework_assigned_to_stud: "الواجب القادم المطلوب من الطلاب:",
    auto_enter_details_of_homework_pag: "أدخل تفاصيل الواجب والصفحات المطلوبة والتمارين المحددة للحصة القادمة...",
    auto_status_performance_of_eac: "👥 حالة وأداء كل طالب في المجموعة:",
    auto_previous_homework_lastse: "🎒 واجب الحصة السابقة: ${lastSessionHwStatus === 'yes' ? 'تم الحل بالكامل 👍' : 'لم يتم الحل 👎'}",
    auto_present_10: "حضر ✅",
    auto_absent_11: "غاب ✕",
    auto_previous_homework_performance: "أداء الواجب السابق:",
    auto_completed_12: "عمل الواجب 👍",
    auto_not_completed_13: "لم يعمل الواجب 👎",
    auto_dictation_grade_out_of_10: "درجة الإملاء (من 10):",
    auto_exam_quiz_grade_out_of_10: "درجة الامتحان/الـ Quiz (من 10):",
    auto_parent_student_notes_option: "ملاحظات ولي الأمر والطالب (اختياري):",
    auto_e_g_excellent_listening_skill: "مثال: متميز جداً اليوم في الاستماع، يحتاج مراجعة أدوات الاستفهام...",
    auto_absent_exempt_from_grades: "✕ غائب - معفى من الدرجات والواجب لهذه الحصة",
    auto_please_complete_the_following: "يرجى إكمال الحقول التالية لحفظ الحصة:",
    auto_subject_taught_field: "حقل ماذا تم شرحه في الحصة",
    auto_next_homework_field: "حقل الواجب المنزلي القادم",
    auto_homework_status: "حالة الواجب",
    auto_dictation_grade: "درجة الإملاء",
    auto_exam_grade: "درجة الامتحان",
    auto_student_14: "الطالب",
    auto_needs: "يحتاج",
    auto: "، ",
    auto_end_session_save_report: "إنهاء الحصة وحفظ التقرير",
    auto_parent_communication: "التواصل مع أولياء الأمور:",
    auto_egp: "ج.م",
    auto_back_to_settings: "العودة للإعدادات",
    auto_notification_alert_settings: "إعدادات الإشعارات والتنبيهات",
    auto_sync_schedule: "تحديث الجدول",
    auto_customize_all_system_notificat: "تخصيص جميع إشعارات النظام، مواعيد التذكير بالححص، وتصريحات Android",
    auto_no_pending_scheduled_notificat: "لا توجد إشعارات معلقة في الانتظار حالياً",
    auto_click_rebuild_schedules_to_p: "اضغط على \"إعادة بناء الجدول\" لأداء فحص فوري وجدولة الحصص القادمة.",
    auto_automatic_system_alerts: "تنبيهات النظام التلقائية",
    auto_mark_all_as_read: "تحديد الكل كمقروء",
    auto_clear_all: "حذف الكل",
    auto_no_new_notifications: "لا توجد إشعارات جديدة.",
    auto_open_lesson: "فتح الحصة",
    auto_completed_lesson_dates: "• مواعيد الحصص المكتملة",
    auto_flexible_prorated_billing: "الفوترة الجزئية وإنهاء الدورة مبكراً",
    auto_you_can_end_the_current_cycle: "يمكنك إنهاء الدورة الحالية للطلاب مبكراً والمطالبة بالدفع بناءً على الحصص التي حضروها فعلياً.",
    auto_there_are_currently_no_student: "لا يوجد طلاب لديهم حصص مكتملة غير مفوترة حالياً تحت الحد الأقصى للدورة.",
    auto_prorated_amount: "القيمة المقترحة",
    auto_attended_lessons: "الحصص المكتملة:",
    auto_lessons: "حصة",
    auto_force_cycle_bill: "إنهاء الدورة والفوترة",
    auto_force_end_current_cycle_bill: "إنهاء الدورة الحالية والمطالبة بالدفع",
    auto_student_name_15: "اسم الطالب:",
    auto_group_16: "المجموعة:",
    auto_attendance_progress: "معدل الحضور:",
    auto_attended_proratemodalitem_le: "حضر ${prorateModalItem.lessonDates.length} حصص من أصل دورة من ${prorateModalItem.cycleLength} حصص",
    auto_completed_lesson_dates_17: "تواريخ الحصص المنجزة:",
    auto_adjust_prorated_due_amount: "تعديل القيمة المستحقة للدفع الجزئي:",
    auto_the_suggested_amount_is_calc: "* تم حساب القيمة المقترحة تلقائياً بناءً على متوسط قيمة الحصة الواحدة. يمكنك تعديل المبلغ يدوياً قبل تأكيد الفاتورة.",
    auto_mark_as_unpaid_invoice: "تسجيل كفاتورة غير مدفوعة",
    auto_flexible_prorated_payment_p: "دفع جزئي مرن (${prorateModalItem.lessonDates.length}/${prorateModalItem.cycleLength} حصص)",
    auto_mark_paid_now: "تسجيل كمدفوع بالكامل فوراً",
    auto_profile_work_schedule: "الملف الشخصي للمعلم",
    auto_personal_information_contact: "الاسم، البريد، ساعات العمل والعملة",
    auto_payments_finance: "بيانات التحويل والدفع",
    auto_financial_information_transfe: "رقم الهاتف، انستا باي، فودافون كاش والروابط",
    auto_messages_communication: "قوالب رسائل أولياء الأمور",
    auto_automated_parent_communication: "إدارة قوالب الواجبات، الحضور، الغياب والتقارير",
    auto_6_templates: "6 قوالب",
    auto_notifications_alerts: "الإشعارات والتنبيهات",
    auto_reminders_lesson_alerts_dai: "التحكم الشامل بإشعارات الحصص، المواعيد، المستحقات والملخص اليومي",
    auto_active: "مفعلة",
    auto_disabled: "معطل (عدم الإظهار)",
    auto_appearance_language: "اللغة والمظهر",
    auto_personalize_the_interface_expe: "لغة الواجهة ووضع المظهر الداكن/الفاتح",
    auto_motivation_gratitude: "الإلهام والامتنان",
    auto_daily_inspiration_and_positive: "تذكيرات وأدعية للمعلم عن العلم والرزق والتعليم",
    auto_daily: "تذكير يومي",
    auto_before_lesson: "قبل أول حصة",
    auto_random: "عشوائي يومي",
    auto_data_backup: "النسخ الاحتياطي والبيانات",
    auto_backup_restore_and_data_manag: "تنزيل واستعادة النسخة الاحتياطية وإعادة ضبط البيانات",
    auto_about: "حول التطبيق",
    auto_application_information_and_ve: "تفاصيل التطبيق، الميزات، المطور والتواصل",
    auto_select_a_section_to_manage_app: "اختر قسماً لإدارة إعدادات التطبيق",
    auto_search_settings: "ابحث في الإعدادات...",
    auto_no_results_found: "لا توجد نتائج",
    auto_select_a_category: "اختر قسماً",
    auto_choose_a_category_from_the_sid: "اختر قسماً من القائمة الجانبية لعرض وإدارة الإعدادات الخاصة به.",
    auto_language_appearance: "اللغة والمظهر",
    auto_choose_application_language_an: "اختر لغة التطبيق ومظهر الشاشة",
    auto_note_the_selected_language_ap: "ملاحظة: اللسان واللغة المختارة تنطبق على واجهة التطبيق بالكامل. رسائل أولياء الأمور والتقارير الموجهة للأهالي تظل دائماً باللغة العربية.",
    auto_accent_color: "لون الواجهة (Accent Color)",
    auto_select_your_preferred_accent_c: "اختر لون التمييز المفضل لجميع الأزرار والأيقونات والتبويبات النشطة وعناصر الواجهة التفاعلية.",
    auto_teacher_profile: "الملف الشخصي للمعلم",
    auto_manage_personal_details_worki: "إدارة البيانات الشخصية وساعات العمل والعملة",
    auto_edit_profile: "تعديل البيانات",
    auto_weekly_working_hours: "ساعات العمل الأسبوعية",
    auto_sat: "السبت",
    auto_sun: "الأحد",
    auto_mon: "الإثنين",
    auto_tue: "الثلاثاء",
    auto_wed: "الأربعاء",
    auto_thu: "الخميس",
    auto_fri: "الجمعة",
    auto_reminder_settings: "إعدادات التنبيهات والتذكير",
    auto_in_app_lesson_alerts_within_3: "تنبيهات الحصص المباشرة (قبل 30 دقيقة)",
    auto_browser_push_notifications: "إشعارات المتصفح والسطح",
    auto_payment_information: "بيانات التحويل والدفع",
    auto_information_used_when_sending: "البيانات المستخدمة عند إرسال مطالبات الرسوم لأولياء الأمور",
    auto_direct_electronic_payment_prof: "بيانات الدفع الإلكتروني المباشر",
    auto_copy_payment_info: "نسخ بيانات التحويل",
    auto_parent_message_templates: "قوالب رسائل أولياء الأمور",
    auto_manage_templates_for_homework: "تخصيص الرسائل التلقائية للواجبات، الحضور، الغياب والتقارير",
    auto_absence: "الغياب",
    auto_exam_reports: "الاختبارات",
    auto_lesson_summary: "ملخص الدرس",
    auto_message_template_text_arabic: "نص قالب الرسالة (بالعربية)",
    auto_available_dynamic_placeholders: "المتغيرات المتاحة للاستخدام تلقائياً:",
    auto_reset_to_default: "استعادة الافتراضي",
    auto_save_templates: "حفظ القوالب",
    auto_inspiration_gratitude: "الإلهام والامتنان",
    auto_teacher_reminders_motivation: "تذكيرات وأدعية للمعلم",
    auto_display_settings: "إعدادات الظهور",
    auto_frequency: "تكرار التذكير",
    auto_once_daily: "مرة واحدة يومياً",
    auto_before_first_lesson: "قبل الحصة الأولى في اليوم",
    auto_randomly_during_day: "عشوائي خلال اليوم",
    auto_display_method: "طريقة العرض",
    auto_in_app_only_card: "داخل التطبيق فقط (بطاقة)",
    auto_system_notification_only: "إشعار نظام فقط",
    auto_in_app_notification: "داخل التطبيق + إشعار",
    auto_message_source: "مصدر الرسائل",
    auto_all_messages: "جميع الرسائل",
    auto_favorites_only: "المفضلة فقط",
    auto_test_reminder_now: "تجربة التذكير الآن",
    auto_messages: "رسالة",
    auto_manage_the_motivational_quotes: "إدارة العبارات التحفيزية والأدعية التي تظهر لك. يمكنك إضافة رسائلك الخاصة أو تفضيل الرسائل التي تحبها.",
    auto_manage_messages: "إدارة الرسائل",
    auto_all: "الكل",
    auto_favorites: "المفضلة",
    auto_add_message: "إضافة رسالة",
    auto_restore_default_messages: "استعادة الرسائل الافتراضية",
    auto_custom: "مخصص",
    auto_are_you_sure: "هل أنت متأكد من الحذف؟",
    auto_no_messages_found: "لا توجد رسائل",
    auto_edit_message: "تعديل الرسالة",
    auto_add_new_message: "إضافة رسالة جديدة",
    auto_write_your_message: "اكتب رسالتك أو دعاءك هنا...",
    auto_restore_defaults: "استعادة الرسائل الافتراضية",
    auto_default_messages_will_be_resto: "سيتم استعادة الرسائل والأدعية الافتراضية. رسائلك المخصصة لن يتم حذفها.",
    auto_restore: "استعادة",
    auto_backup_data_management_cente: "مركز النسخ الاحتياطي وإدارة البيانات",
    auto_create_full_backups_password: "إنشاء نسخ احتياطية شاملة، تشفير بكلمة مرور، استعادة انتقائية، وإدارة التعديلات",
    auto_smart_data_validation_health: "التدقيق الذكي وصحة البيانات",
    auto_inspect_record_consistency_de: "فحص اتساق السجلات، الكشف عن الأخطاء المحتملة في العلاقات المالية والطلابية، وحساب مؤشر الصحة.",
    auto_open_data_audit_health_repor: "فتح تقرير التدقيق وصحة البيانات",
    auto_danger_zone_data_reset: "منطقة الخطر (إعادة ضبط البيانات)",
    auto_sensitive_actions_resetting_d: "إجراءات حساسة: سيؤدي هذا إلى حذف كافة الطلاب والمجموعات والحصص والمدفوعات نهائياً من هذا الجهاز.",
    auto_application_details_features: "معلومات التطبيق والميزات وتفاصيل التواصل مع المطور",
    auto_german_teacher_management_syst: "نظام إداري متكامل لمعلمي اللغة الألمانية والدروس الخاصة",
    auto_description: "الوصف",
    auto_features: "الميزات الرئيسية (Features)",
    auto_developer: "تطوير وتصميم",
    auto_please_select_at_least_one_cat: "⚠️ يرجى اختيار فئة واحدة على الأقل للتصدير.",
    auto_gathering_and_preparing_backup: "جاري تجميع وإعداد البيانات...",
    auto_encrypting_payload_with_passwo: "جاري تشفير البيانات بكلمة المرور...",
    auto_backup_file_created_and_down: "✓ تم إنشاء وتنزيل ملف النسخة الاحتياطية بنجاح!",
    auto_quick_backup_created_and_sav: "✓ تم إنشاء وتنزيل النسخة الاحتياطية بنجاح!",
    auto_backup_failed: "❌ فشل إنشاء النسخة الاحتياطية: ",
    auto_all_data_restored_successful: "✓ تم استعادة جميع البيانات بنجاح تام وتم حفظ الملف!",
    auto_failed_to_restore_data_plea: "❌ فشل استعادة البيانات. يرجى التأكد من اختيار ملف JSON صحيح.",
    auto_incorrect_password_or_corrupte: "كلمة المرور غير صحيحة أو الملف تالف.",
    auto_selected_categories_restored: "✓ تم استعادة البيانات المحددة بنجاح مع إنشاء نقطة استعادة تلقائية!",
    auto_rollback_successful_restore: "✓ تم التراجع واستعادة النسخة السابقة بنجاح!",
    auto_smart_backup_restore_center: "مركز النسخ الاحتياطي والاستعادة الذكي",
    auto_professional_data_management: "إدارة شاملة لآمان البيانات، التشفير بكلمة المرور، الاستعادة الانتقائية والتراجع التلقائي",
    auto_undo_last_restore: "التراجع عن آخر عملية استعادة",
    auto_undo_last_restore_18: "التراجع عن آخر استعادة",
    auto_1_tap_backup: "نسخ سريع (1-Tap)",
    auto_custom_export: "تصدير مخصص",
    auto_custom_restore: "استعادة مخصصة",
    auto_auto_backups: "النسخ التلقائي",
    auto_restore_history: "سجل الاستعادة",
    auto_instant_1_click_backup: "حفظ نسخة احتياطية سريعة",
    auto_export_and_save_a_complete_bac: "قم بتنزيل أو حفظ ملف يحتوي على كامل بيانات التطبيق (المعلمين، الطلاب، المجموعات، الحصص، والمدفوعات) بضغطة واحدة وبدون تعقيدات.",
    auto_saving_and_sharing: "جاري الحفظ والمشاركة...",
    auto_tap_to_backup_save_everythin: "اضغط للنسخ الاحتياطي والحفظ",
    auto_instant_1_click_restore: "استعادة كاملة بضغطة واحدة",
    auto_select_a_backup_json_file_you: "اختر ملف نسخة احتياطية (ملف JSON تم تحميله سابقاً) وسيقوم التطبيق فوراً باستعادة كافة السجلات وإرجاع حالتها الأصلية مع الحفاظ التلقائي على نسخة احتياطية للتراجع.",
    auto_restoring_all_data: "جاري استعادة البيانات والملفات...",
    auto_choose_file_restore_all: "اختر ملف واسترجع الآن",
    auto_automatic_data_protection: "حماية تلقائية للبيانات",
    auto_before_performing_any_restore: "عندما تقوم بعملية استعادة سريعة، يقوم النظام تلقائياً بأخذ لقطة تأمينية لبياناتك الحالية. في حال رغبت بالتراجع عن الاستعادة وإرجاع بياناتك السابقة، يمكنك الضغط على زر \"التراجع عن آخر استعادة\" باللون البرتقالي في الأعلى.",
    auto_select_all: "تحديد الكل",
    auto_deselect_all: "إلغاء التحديد",
    auto_full_backup_selected_100: "تحديد كامل (100%)",
    auto_partial_selection_selectedc: "تحديد جزئي (${selectedCategories.length}/${ALL_BACKUP_CATEGORIES.length})",
    auto_full_backup_preview: "معاينة النسخة الاحتياطية الكاملة",
    auto_partial_backup_preview: "معاينة النسخة الاحتياطية الجزئية",
    auto_payload_details_and_estimated: "تفاصيل البيانات المشمولة والحجم التقديري قبل التصدير",
    auto_total_records: "سجل إجمالي",
    auto_groups: "المجموعات",
    auto_estimated_size: "الحجم التقديري",
    auto_estimated_time: "وقت التخمين",
    auto_password_protect_encrypt_bac: "حماية الملف بكلمة مرور (تشفير AES)",
    auto_enter_encryption_password: "أدخل كلمة مرور حماية الملف...",
    auto_this_password_will_be_required: "سيتطلب فتح الملف أو استعادته إدخال هذه كلمة المرور.",
    auto_creating_backup_file: "جاري إنشاء الملف...",
    auto_download_full_backup_json: "تنزيل النسخة الاحتياطية الكاملة (JSON)",
    auto_download_partial_backup_sel: "تنزيل النسخة الاحتياطية الجزئية (${selectedCategories.length} فئات)",
    auto_select_or_drop_backup_file_js: "اختر أو أسقط ملف النسخة الاحتياطية (JSON)",
    auto_supports_standard_and_password: "يدعم ملفات النسخ الاحتياطي العادية والمشفرة بكلمة مرور",
    auto_browse_json_file: "تصفح الجهاز لملف JSON",
    auto_this_backup_file_is_password_p: "هذا الملف مشفر بكلمة مرور",
    auto_enter_password_to_unlock: "أدخل كلمة المرور لفك التشفير...",
    auto_unlock: "فك التشفير",
    auto_backup_type_analysis_backup: "نوع النسخة: ${analysis.backupType}",
    auto_verified_structure: "تحليل آمن للبيانات",
    auto_restore_mode: "طريقة الاستعادة (Restore Mode)",
    auto_smart_restore_default: "استعادة ذكية (مستحسن)",
    auto_detect_duplicates_update_exis: "اكتشاف التكرارات، تحديث السجلات الحالية، وإضافة الجديدة بدون فقدان البيانات.",
    auto_merge_mode: "دمج البيانات (Merge)",
    auto_keep_current_data_add_importe: "الاحتفاظ بالبيانات الحالية مع إضافة جميع سجلات الاستيراد بدون حذف.",
    auto_replace_mode: "استبدال كلي (Replace)",
    auto_replace_current_data_with_impo: "استبدال البيانات الحالية تماماً بالبيانات المستوردة.",
    auto_categories_to_restore: "اختر الفئات المراد استعادتها",
    auto_select_all_available: "تحديد كل فئات الملف",
    auto_restore_impact_report: "تقرير التأثير قبل الاستعادة (Restore Impact Report)",
    auto_records_to_add: "سجلات جديدة ستضاف",
    auto_records_to_update: "سجلات سيتم تحديثها",
    auto_duplicates_detected: "سجلات مكررة",
    auto_potential_conflicts: "تعارضات محتملة",
    auto_creating_restore_point_apply: "جاري إنشاء نقطة استعادة وتطبيق التغييرات...",
    auto_warning_replace_mode_will_ove: "تنبيه هام: وضع الاستبدال سيقوم باستبدال البيانات الحالية!",
    auto_an_automatic_restore_point_sna: "سيتم أخذ نقطة استعادة تلقائية قبل التطبيق حتى تتمكن من التراجع في أي وقت.",
    auto_confirm_replace_restore: "تأكيد الاستبدال والاستعادة",
    auto_restore_everything: "استعادة كل شيء (Restore Everything)",
    auto_restore_selected_categories: "استعادة الفئات المحددة (${selectedRestoreCategories.length})",
    auto_automatic_backup_retention_s: "إعدادات النسخ الاحتياطي التلقائي وسجل الاحتفاظ",
    auto_schedule_periodic_background_s: "حفظ نسخ احتياطية دورية تلقائياً وتحديد عدد النسخ المحتفظ بها",
    auto_daily_automatic_backup: "نسخة احتياطية يومية",
    auto_capture_a_daily_data_snapshot: "حفظ لقطة يومية من البيانات عند فتح التطبيق",
    auto_weekly_automatic_backup: "نسخة احتياطية أسبوعية",
    auto_capture_a_weekly_snapshot_auto: "حفظ لقطة أسبوعية منتظمة من البيانات",
    auto_monthly_automatic_backup: "نسخة احتياطية شهرية",
    auto_capture_a_monthly_snapshot_for: "حفظ لقطة شهرية لمراجعة نهاية الشهر",
    auto_backup_retention_policy: "سياسة الاحتفاظ بالنسخ الاحتياطية (Retention Policy)",
    auto_keep_last_cnt: "آخر ${cnt} نسخ",
    auto_restore_operation_history: "سجل عمليات الاستعادة والصيانة",
    auto_chronological_audit_log_of_all: "عرض السجل التاريخي لجميع عمليات استعادة البيانات السابقة",
    auto_no_restore_history_logged_yet: "لا توجد عمليات استعادة مسجلة حالياً.",
    auto_student_smart_card: "بطاقة الطالب الذكية",
    auto_active_19: "نشط ✓",
    auto_archived: "مؤرشف ⚪",
    auto_bearbeiten: "تعديل",
    auto_l_schen: "حذف",
    auto_call_parent: "اتصال بالأب",
    auto_call_student: "اتصال بالطالب",
    auto_overview: "Übersicht",
    auto_attendance_presentcount_l: "Anwesenheit (${presentCount + lateCount + absentCount})",
    auto_grades_homework: "Noten & Aufgaben",
    auto_files_student_documents_len: "Dateien (${student.documents.length})",
    auto_allgemeine_informationen: "ALLGEMEINE INFORMATIONEN",
    auto_import_group_students: "استيراد مجموعة + طلاب",
    auto_no_students_yet: "لا يوجد طلاب حتى الآن",
    auto_add_your_first_student_to_trac: "أضف طالبك الأول للبدء في تتبع الحضور، الدروس والمدفوعات.",
    auto_parent: "ولي الأمر",
    auto_student_20: "الطالب",
    auto_options: "خيارات المجموعة",
    auto_view_profile: "الملف الشخصي",
    auto_check_attendance: "تتبع الحضور",
    auto_scores_homework: "الدرجات والواجبات",
    auto_payment_history: "السجلات المالية",
    auto_send_whatsapp: "إرسال واتساب",
    auto_call_phone: "اتصال هاتفياً",
    auto_delete_archive: "حذف أو أرشفة",
    auto_no_groups_yet: "لا توجد مجموعات حتى الآن",
    auto_create_your_first_group_to_sta: "أنشئ مجموعتك الأولى للبدء في تنظيم الطلاب والدروس.",
    auto_view_details: "عرض تفاصيل المجموعة",
    auto_online: "أونلاين",
    auto_center: "سنتر",
    auto_home: "منزل",
    auto_private: "خاص",
    auto_in_person: "حضوري",
    auto_lesson: "حصة",
    alert_add_zoom_link: "برجاء إضافة رابط الزووم للجروب أولاً قبل إرسال التذكير.",
    alert_no_parent_phone: "لا يوجد رقم هاتف مسجل لولي الأمر. يرجى إضافة الرقم في بيانات الطالب.",
    alert_finish_lesson_first: "يرجى إنهاء الحصة أولاً بالضغط على زر \"إنهاء الحصة وحفظ التقرير\" لتتمكن من فتح تقرير ولي الأمر.",
    zoom_saved: "تم الحفظ",
    zoom_save_group: "حفظ للجروب",
    message_preview: "معاينة الرسالة",
    restore_original_text: "استعادة النص الأصلي",
    setup_subtitle: "مساعد معلم اللغة الألمانية",
    setup_description: "إدارة الطلاب، الحصص، المدفوعات، الواجبات المنزلية والتواصل مع أولياء الأمور في مساحة عمل واحدة جميلة.",
    settings_live_preview: "معاينة مباشرة",
    settings_primary_button: "زر أساسي",
    settings_secondary_button: "ثانوي",
    settings_premium_widget: "ودجيت مميز",
    settings_adapts_accent: "يتكيف مع لون التمييز",
    student_sitzungen: "الحصص",
    student_anwesend: "حضور",
    student_paketzyklus: "الباقات",
    student_doc_homework: "ملف واجب",
    student_doc_exam: "ملف اختبار",
    student_doc_general: "مستند طالب",
    student_notizen: "ملاحظات",},

  en: {
    notifications_title: 'Notifications',
    free_time_available_today: 'Available Today',
    nav_home: 'Home',
    nav_schedule: 'Schedule',
    nav_students: 'Students',
    nav_history: 'History',
    nav_payments: 'Payments',
    nav_reports: 'Reports',
    nav_settings: 'Settings',
    nav_quickLesson: 'Quick Lesson',
    nav_more: 'More',
    nav_widgets: 'Android Widgets',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    greeting: 'Welcome',
    refreshData: 'Refresh data',
    dataRefreshed: 'Data refreshed successfully',
    upcomingLessonAlert: 'Upcoming lesson',
    open: 'Open',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    all: 'All',
    filter: 'Filter',
    status: 'Status',
    date: 'Date',
    time: 'Time',
    notes: 'Notes',
    confirm: 'Confirm',
    back: 'Back',
    close: 'Close',
    actions: 'Actions',
    copied: 'Copied',
    yes: 'Yes',
    no: 'No',
    archive: 'Archive',
    status_completed: 'Completed',
    status_cancelled: 'Cancelled',
    status_upcoming: 'Upcoming',
    status_in_progress: 'In progress',
    status_pending: 'Pending',
    status_scheduled: 'Scheduled',
    att_present: 'Present',
    att_absent: 'Absent',
    att_late: 'Late',
    hw_assigned: 'Assigned',
    hw_completed: 'Completed',
    hw_not_completed: 'Not completed',
    settings_title: 'Settings & Account',
    settings_sub: 'Manage account, interface language, and backup',
    settings_language: 'Interface Language',
    settings_lang_desc: 'Select the language for the app interface',
    settings_parent_comm_notice: 'Note: Parent reports and messages are always generated in Arabic.',
    settings_theme: 'Appearance',
    settings_theme_light: 'Light mode',
    settings_theme_dark: 'Dark mode',
    settings_profile: 'Teacher Profile',
    settings_name: 'Teacher name',
    settings_email: 'Email',
    settings_currency: 'Currency',
    settings_working_hours: 'Working hours',
    settings_start_time: 'Start time',
    settings_end_time: 'End time',
    settings_payment_details: 'Payment Details',
    settings_phone: 'Phone number',
    settings_instapay: 'InstaPay ID',
    settings_vodafone: 'Vodafone Cash',
    settings_bank: 'Bank account',
    settings_payment_link: 'Payment link',
    settings_share_payment: 'Copy payment details',
    settings_backup: 'Backup & Restore',
    settings_download_backup: 'Download backup',
    settings_restore_backup: 'Restore from file',
    settings_clear_data: 'Clear all data',
    settings_save_success: 'Changes saved successfully',
    schedule_title: 'Lesson Schedule',
    schedule_today: 'Today',
    schedule_week: 'Week',
    schedule_month: 'Month',
    schedule_add_lesson: 'Add lesson',
    schedule_start_now: 'Start lesson now',
    schedule_no_lessons: 'No scheduled lessons',
    schedule_conflict: 'Conflict',
    schedule_working_hours: 'Working hours',
    schedule_refresh: 'Refresh',
    schedule_ical: 'Export Calendar',
    schedule_no_conflicts: 'No time conflicts',
    schedule_day_view: 'Day view',
    schedule_week_view: 'Week view',
    schedule_month_view: 'Month view',
    schedule_reschedule: 'Reschedule',
    schedule_new_date: 'New date',
    schedule_new_time: 'New time',
    schedule_conflict_alert: 'Alert: Conflict detected for this time slot',
    schedule_reschedule_success: 'Lesson rescheduled successfully',
    schedule_weekly: 'Weekly',
    schedule_no_lessons_day: 'No lessons scheduled for this day',
    schedule_add_lesson_for: 'Add new lesson',
    lesson_control_title: 'Lesson Control',
    lesson_timer: 'Live Lesson Timer',
    lesson_duration: 'Duration',
    lesson_start: 'Start lesson',
    lesson_resume: 'Resume lesson',
    lesson_pause: 'Pause lesson',
    lesson_end: 'End lesson',
    lesson_cancel: 'Cancel lesson',
    lesson_report_form: 'Lesson Report',
    lesson_show_timer: 'Show timer',
    lesson_attendance: 'Attendance',
    lesson_homework: 'Homework',
    lesson_teacher_notes: 'Teacher notes',
    lesson_parent_report_btn: 'Parent Report',
    lesson_save_report: 'Save report',
    students_title: 'Students & Groups',
    students_tab_all: 'All Students',
    students_tab_groups: 'Groups',
    students_add_student: '+ Student',
    students_add_group: '+ Group',
    students_search_placeholder: 'Search student, parent or phone...',
    students_search_group_placeholder: 'Search group...',
    students_group_name: 'Group name',
    students_student_name: 'Student name',
    students_grade: 'Grade level',
    students_parent_phone: 'Parent phone',
    students_student_phone: 'Student phone',
    students_package: 'Package',
    students_no_students: 'No students yet',
    students_no_groups: 'No groups yet',
    students_group: 'Group',
    students_individual: 'Individual',
    students_active: 'Active',
    students_archived: 'Archived',
    students_lessons_count: 'Lesson count',
    students_phone: 'Phone',
    students_parent_phone_label: 'Parent',
    students_details: 'Details',
    students_all_grades: 'All Grades',
    students_no_students_found: 'No students found.',
    students_all_days: 'All Days',
    students_today: 'Today',
    students_archive_info: 'Archived students and groups remain stored in history and can be reactivated at any time.',
    students_archived_students_title: 'Archived Students',
    students_no_archived_students: 'No archived students.',
    students_archived_groups_title: 'Archived Groups',
    students_no_archived_groups: 'No archived groups.',
    students_restore: 'Restore',
    students_reset_filters: 'Reset Filters',
    history_title: 'Session History',
    history_header_sub: 'View and manage history of all past sessions and reports',
    history_total_lessons: 'Total Lessons',
    history_completed: 'Completed',
    history_cancelled_missed: 'Cancelled / Absent',
    history_total_hours: 'Total Hours',
    history_filter_all: 'All',
    history_filter_completed: 'Completed',
    history_filter_cancelled: 'Cancelled',
    history_filter_pending: 'Pending',
    history_search_placeholder: 'Search by student, group or topic...',
    history_search: 'Search history',
    history_export: 'Export history',
    history_filter_entity_label: 'Filter by Student/Group:',
    history_all_entities: 'All Students & Groups',
    history_groups_category: 'Groups',
    history_students_category: 'Students',
    history_filter_period_label: 'Time Period:',
    history_period_all: 'All Time',
    history_period_today: 'Today',
    history_period_this_week: 'This Week',
    history_period_this_month: 'This Month',
    history_results_count: 'History Results ({count} lessons)',
    history_reset_filters: 'Reset Filters',
    payments_title: 'Payment Management',
    payments_total_collected: 'Collected',
    payments_total_pending: 'Pending',
    payments_completed_cycle: 'Completed Cycle',
    payments_daily_summary: 'Daily Summary',
    payments_details_heading: 'Details',
    payments_due_tab: 'Due',
    payments_history_sub: 'Payment history records',
    payments_monthly_summary: 'Monthly Summary',
    payments_no_cycles_period: 'No paid cycles.',
    payments_no_due_sub: 'No payments are due right now.',
    payments_not_yet_btn: 'Not Yet',
    payments_paid_btn: 'Paid',
    payments_parent_notice: 'Parent Notice',
    payments_pending_tag: 'Pending',
    payments_weekly_summary: 'Weekly Summary',
    payments_daily_gain: 'Daily Revenue',
    payments_weekly_gain: 'Weekly Revenue',
    payments_monthly_gain: 'Monthly Revenue',
    payments_overdue: 'Overdue',
    payments_expected: 'Expected',
    payments_revenue_overview: 'Revenue Overview',
    payments_record: 'Record payment',
    payments_send_reminder: 'Send reminder',
    payments_paid: 'Paid',
    payments_unpaid: 'Unpaid',
    payments_partial: 'Partially paid',
    payments_collected: 'Collected',
    payments_pending: 'Pending',
    payments_plan: 'Payment Plan',
    payments_history: 'Payment History',
    payments_method: 'Payment Method',
    payments_due_date: 'Due Date',
    payments_daily: 'Daily:',
    payments_weekly: 'Weekly:',
    payments_monthly: 'Monthly:',
    payments_total_pending_label: 'Total Pending',
    payments_open_tab: 'Open Payments',
    payments_history_tab: 'Payment History',
    payments_all_groups: 'All Groups',
    payments_no_due_title: 'No due payments available ✨',
    payments_no_due_desc: 'All students are currently up to date. Students will appear here automatically only after completing their payment cycle (e.g., 4/4 or 8/8 lessons).',
    payments_completed_dates_label: 'Completed lesson dates in this cycle:',
    payments_pending_expectation: '(Pending ⏳)',
    payments_amount_due: 'Amount Due',
    payments_mark_paid: 'Mark Paid',
    payments_mark_not_yet: 'Not Yet',
    payments_notify_parent_wa: 'Notify Parent (WhatsApp)',
    payments_no_history: 'No payment history recorded',
    payments_history_auto_archive: 'Paid cycles are automatically archived here.',
    payments_paid_on: 'Paid on:',
    payments_notice_title: 'Payment Notice to Parent',
    payments_copy_text: 'Copy Text',
    payments_copied: 'Copied! ✓',
    payments_open_whatsapp: 'Open WhatsApp',
    payments_daily_gain_title: 'Daily Revenue (Today)',
    payments_weekly_gain_title: 'Weekly Revenue (Last 7 Days)',
    payments_monthly_gain_title: 'Monthly Revenue (This Month)',
    payments_gain_summary_sub: 'Revenue Summary & Paid Cycles',
    payments_total_gains: 'Total Revenue',
    payments_paid_cycles: 'Paid Cycles',
    payments_details_header: 'Payment Details',
    payments_no_paid_period: 'No paid cycles in this period.',
    reports_title: 'Reports & Analytics',
    reports_header_sub: 'Sessions, weekly revenue & payment tracking',
    reports_print_pdf: 'Print / PDF',
    reports_collected_revenue: 'Collected Revenue',
    reports_from_paid_sessions: 'Collected from sessions',
    reports_unpaid_amount: 'Pending Amount',
    reports_pending_payments: 'Pending payments',
    reports_sessions_completed: 'Sessions Completed',
    reports_total_conducted: 'Total conducted',
    reports_unpaid_last_sessions: 'Unpaid Final Sessions',
    reports_urgent_collect: '⚠️ Collect urgently!',
    reports_all_good: 'Everything in order',
    reports_weekly_protocol: 'Weekly Sessions & Revenue Protocol',
    reports_weekly_protocol_sub: 'Every session with received fees and payment alerts',
    reports_filter_all: 'All',
    reports_filter_this_week: 'This Week',
    reports_filter_paid: 'Paid',
    reports_filter_unpaid: 'Unpaid',
    reports_no_sessions_filter: 'No sessions found for selected filter.',
    reports_weekly_chart_title: 'Weekly Revenue Comparison',
    reports_attendance_overview_title: 'Student Attendance Overview',
    reports_total_lessons: 'Total lessons',
    reports_active_students: 'Active students',
    reports_attendance_rate: 'Attendance rate',
    reports_lessons_completed: 'Completed lessons',
    reports_revenue: 'Revenue',
    reports_students: 'Students count',
    reports_export_pdf: 'Export PDF Report',
    daily_stats_lessons_today: 'Lessons Today',
    daily_stats_students_today: 'Students Today',
    daily_stats_revenue_today: 'Revenue Today',
    daily_stats_completed: 'Completed',
    daily_stats_monthly_overview: 'Monthly Overview',
    daily_stats_students: 'Students',
    daily_stats_groups: 'Groups',
    daily_stats_completed_short: 'Completed',
    daily_stats_revenue: 'Revenue',
    tomorrows_lessons_title: "Tomorrow's Lessons",
    no_lessons_tomorrow: 'No lessons scheduled for tomorrow ✨',
    weekly_overview_title: 'Weekly Overview',
    weekly_overview_sub: 'Friday - Thursday',
    stat_remaining: 'Remaining',
    stat_cancelled: 'Cancelled',
    stat_uncollected: 'Uncollected',
    stat_total_expected: 'Total Expected',
    smart_summary_title: 'Smart Daily Summary',
    smart_summary_badge: 'Smart Update',
    smart_summary_today: 'Today',
    smart_summary_expected_income: 'Expected Income',
    smart_summary_first_lesson: 'First Lesson',
    smart_summary_overdue_students: 'Overdue Students',
    smart_summary_todays_lessons: "Today's Lessons",
    smart_summary_todays_students: "Today's Students",
    smart_summary_no_lessons_regular: 'No lessons scheduled for today. All payments are up to date ✨',
    next_action_title: 'NEXT LESSON',
    next_action_no_lessons: 'No upcoming lessons for the selected filter',
    next_action_today: 'Today',
    next_action_tomorrow: 'Tomorrow',
    next_action_this_week: 'This Week',
    next_action_all: 'All',
    next_action_online: 'Online',
    next_action_offline: 'Offline',
    next_action_open: 'Open Lesson',
    time_in_progress: 'In progress now',
    time_starts_in: 'Starts soon',
    time_starts_at: 'Starts at',
    time_scheduled_today: 'Scheduled today',
    timeline_title: 'Today\'s Lessons',
    todays_lessons_title: 'Today\'s Lessons',
    timeline_pending_action: 'Past Pending Lessons',
    past_pending_lessons_title: 'Past Pending Lessons',
    past_pending_lessons_desc: 'Old lessons from previous days that have no final status:',
    timeline_requires_action: 'Action Required',
    timeline_pending_desc: 'These past lessons have not been completed yet:',
    timeline_no_lessons: 'No lessons scheduled for today',
    timeline_completed_of: 'Lessons completed',
    timeline_live_now: 'LIVE NOW',
    timeline_upcoming: 'Upcoming',
    timeline_group: 'Group',
    timeline_individual: 'Individual',
    system_time: 'System time',
    sofort_badge: 'Start Instant Lesson',
    sofort_title: 'Start Lesson Now (Anytime)',
    sofort_desc: 'Start a lesson immediately for any group, independent of the schedule.',
    quick_lesson_modal_title: 'Quick Lesson',
    quick_lesson_modal_desc: 'For trial / single students without profile',
    students_and_groups_title: 'Students & Groups',
    session_history_modal_title: 'Session History',
    daily_gain_label: 'Daily:',
    weekly_gain_label: 'Weekly:',
    monthly_gain_label: 'Monthly:',
    open_payments_tab: 'Open Payments',
    payment_history_tab: 'Payment History',
    all_groups_option: 'All Groups',
    no_due_payments_title: 'No due payments available ✨',
    no_due_payments_desc: 'All students are currently up to date. Students will appear here automatically only after completing their payment cycle (e.g., 4/4 or 8/8 lessons).',
    dismiss_from_dashboard: 'Hide from Dashboard',
    todo_widget_title: 'To-Do',
    todo_add_placeholder: 'Add a quick task...',
    todo_no_tasks: 'No pending tasks ✨',
    todo_add_btn: 'Add',
    reports_and_analytics_title: 'Reports & Analytics',
    nav_free_time: 'Free Time',
    add_group_title: 'Add New Group',
    add_group_subtitle: 'Enter group details and monthly package',
    lesson_duration_label: 'Lesson Duration',
    schedule_lesson_title: 'Schedule New Lesson',
    save_lesson_btn: 'Save Lesson',
    duplicate_student_warning: 'A student with the same name already exists in this group. Do you want to continue?',
    students_all_groups: 'All Groups',
    payments_no_due: 'No due payments available',
    payment_plan_lessons: 'lessons',
    payments_completed_dates: 'Completed lesson dates',
    reports_copied: 'Report copied',
    reports_and_analyses: 'Reports & Analytics',
    lesson_session_num: 'Session Number',
    daily_stats_student: 'Student',
    todo_more_tasks: 'more tasks...',
  
    auto_please_enter_student_name: "Please enter student name",
    auto_parent_phone_number_is_require: "Parent phone number is required for the student",
    auto_import_group_students_with_a: "Import Group + Students with AI",
    auto_create_group_and_all_students: "Create group and all students at once with AI text",
    auto_ai_import: "AI Import",
    auto_create_a_student_for_this_grou: "Create a Student for This Group / Private Student (1-to-1)",
    auto_initial_student_information: "Initial Student Information",
    auto_student_name: "Student Name *",
    auto_e_g_ahmed_ali: "e.g. Ahmed Ali",
    auto_parent_name: "Parent Name",
    auto_e_g_ali_mahmoud: "e.g. Ali Mahmoud",
    auto_parent_phone: "Parent Phone",
    auto_grade: "Grade",
    auto_student_notes: "Student Notes",
    auto_additional_student_notes: "Additional student notes...",
    auto_save_group: "Save Group",
    auto_parent_phone_number_is_require_1: "Parent phone number is required",
    auto_add_new_student: "Add New Student",
    auto_automatic_group_pricing_inheri: "Automatic Group Pricing Inheritance",
    auto_assigned_group: "Assigned Group *",
    auto_inherited_pricing: "Inherited Pricing:",
    auto_package: "Package: ",
    auto_sessions: "sessions",
    auto_inherited_automatically_from: " Inherited automatically from ${selectedGroup.name}.",
    auto_grade_level: "Grade Level",
    auto_parent_phone_2: "Parent Phone *",
    auto_student_phone_optional: "Student Phone (Optional)",
    auto_special_focus_notes_or_weakn: "Special focus, notes, or weaknesses...",
    auto_save_student: "Save Student",
    auto_import_group_students_ai_te: "Import Group + Students (AI Template)",
    auto_create_an_entire_group_and_all: "Create an entire group and all students in one step",
    auto_group_students_imported_succ: "Group & Students Imported Successfully!",
    auto_group_name: "Group Name:",
    auto_grade_level_3: "Grade Level:",
    auto_students_imported: "Students Imported:",
    auto_students: "Students",
    auto_schedule: "Schedule:",
    auto_view_group_profile: "View Group Profile",
    auto_close: "Close",
    auto_copy_prompt_orders_for_ai: "Copy Prompt / Orders for AI",
    auto_prompt_copied: "Prompt Copied!",
    auto_copy_ai_prompt_orders: "Copy AI Prompt Orders",
    auto_copied: "Copied!",
    auto_sample_data: "Sample Data",
    auto_click_copy_ai_prompt_orders: "Click \"Copy AI Prompt Orders\" and paste it into ChatGPT/Gemini along with your raw group list/notes. Then copy the AI response and paste it into the box below.",
    auto_ai_generated_text: "AI Generated Text:",
    auto_strict_zero_data_loss_validati: "Strict Zero-Data-Loss Validation",
    auto_all_fields_validated_success: "✓ All fields validated successfully. Ready for import.",
    auto_data_preview_before_import: "Data Preview Before Import:",
    auto_students_4: "students",
    auto_group_name_5: "Group Name",
    auto_grade_type: "Grade & Type",
    auto_days_time: "Days & Time",
    auto_zoom_link: "Zoom Link",
    auto_address: "Address",
    auto_student_name_6: "Student Name",
    auto_parent_phone_req: "Parent Phone (Req)",
    auto_student_phone_opt: "Student Phone (Opt)",
    auto_cancel: "Cancel",
    auto_confirm_import: "Confirm Import",
    auto_share_session_report: "Share Session Report",
    auto_bulk_group_report_groups: "📊 Bulk Group Report (${groupStudents.length} students)",
    auto_individual_student_report: "👤 Individual Student Report",
    auto_select_a_student_to_preview: "👥 Select a student to preview individual report:",
    auto_student: "👤 Student:",
    auto_not_specified: "Not specified",
    auto_parent_phone_7: "📱 Parent Phone:",
    auto_not_registered: "Not registered",
    auto_group: "👥 Group:",
    auto_german_group: "German Group",
    auto_whatsapp_group_connected: "WhatsApp Group Connected ✅",
    auto_group_link_not_linked_yet: "⚠️ Group link not linked yet",
    auto_tip_you_can_edit_the_group_to: "Tip: You can edit the group to enter the parents\\' \"WhatsApp Group Link\" to send this bulk report in one click!",
    auto_preview_edit_message: "Preview & Edit Message:",
    auto_copy_text: "Copy Text",
    auto_send_to_whatsapp_group: "Send to WhatsApp Group",
    auto_send_via_whatsapp: "Send via WhatsApp",
    auto_print: "Print",
    auto_phone_call: "Phone Call",
    auto_go_to_homescreen: "Go to Homescreen",
    auto_free_hours: "Free Hours",
    auto_slots: "Slots",
    auto_next_slot: "Next Slot",
    auto_none: "None",
    auto_excellent: "🟢 Excellent",
    auto_needs_cleanup: "🟡 Needs Cleanup",
    auto_critical: "🔴 Critical",
    auto_students_without_group: "Students Without Group",
    auto_sessions_without_group: "Sessions Without Group",
    auto_calendar_sessions_without_grou: "Calendar Sessions Without Group",
    auto_payments_without_group: "Payments Without Group",
    auto_attendance_records_without_gro: "Attendance Records Without Group",
    auto_homework_records_without_group: "Homework Records Without Group",
    auto_exam_records_without_group: "Exam Records Without Group",
    auto_data_health_center: "Data Health Center",
    auto_last_scan_lastscantime: "Last scan: ${lastScanTime}",
    auto_scan_database: "Scan Database",
    auto_data_health_summary: "Data Health Summary",
    auto_database_health_score: "Database Health Score",
    auto_healthy_records: "Healthy Records",
    auto_orphaned_records: "Orphaned Records",
    auto_storage_used: "Storage Used",
    auto_clean_all_orphan_data: "Clean All Orphan Data",
    auto_data_integrity_cleanup: "Data Integrity & Cleanup",
    auto_detect_unlinked_orphaned_data: "Detect unlinked orphaned data",
    auto_1_students_without_group: "1. Students Without Group",
    auto_student_records_whose_groupid: "Student records whose groupId is missing, invalid, or points to a deleted group.",
    auto_2_sessions_without_group: "2. Sessions Without Group",
    auto_lesson_sessions_whose_groupid: "Lesson sessions whose groupId is missing, invalid, or linked to a deleted group.",
    auto_3_calendar_sessions_without_g: "3. Calendar Sessions Without Group",
    auto_calendar_events_whose_groupid: "Calendar events whose groupId is missing, invalid, or linked to a deleted group.",
    auto_4_payments_without_group: "4. Payments Without Group",
    auto_payment_records_linked_to_miss: "Payment records linked to missing or deleted groups.",
    auto_5_attendance_records_without: "5. Attendance Records Without Group",
    auto_attendance_records_linked_to_m: "Attendance records linked to missing or deleted groups.",
    auto_6_homework_records_without_gr: "6. Homework Records Without Group",
    auto_homework_records_linked_to_mis: "Homework records linked to missing or deleted groups.",
    auto_7_exam_quiz_records_without_g: "7. Exam/Quiz Records Without Group",
    auto_exam_results_linked_to_missing: "Exam results linked to missing or deleted groups.",
    auto_profile_field_integrity: "Profile Field Integrity",
    auto_students_with_complete_data: "Students with complete data",
    auto_students_missing_parent_phone: "Students missing parent phone",
    auto_fix_now: "Fix Now",
    auto_groups_missing_schedule: "Groups missing schedule",
    auto_groups_missing_session_price: "Groups missing session price",
    auto_online_groups_missing_zoom_lin: "Online groups missing Zoom link",
    auto_offline_groups_missing_locatio: "Offline groups missing location address",
    auto_total_orphaned_records_getc: "Total orphaned records: ${getCategoryCount(viewCategory)}",
    auto_no_orphaned_records_in_this_ca: "No orphaned records in this category!",
    auto_delete_all_in_category: "Delete All in Category",
    auto_cleanup_orphan_data: "⚠️ Cleanup Orphan Data",
    auto_the_selected_records_are_not_l: "The selected records are not linked to any existing group.",
    auto_records_to_delete_singledel: "Records to delete: ${singleDeleteItemId ? 1 : confirmDeleteTarget === 'all' ? totalOrphanedRecords : getCategoryCount(confirmDeleteTarget)}",
    auto_this_action_cannot_be_undone: "This action cannot be undone.",
    auto_delete_permanently: "Delete Permanently",
    auto_cleanup_complete: "Cleanup Complete",
    auto_dashboard_views_automaticall: "Dashboard & views automatically refreshed",
    auto_deleted_records_breakdown: "Deleted Records Breakdown:",
    auto_sessions_8: "Sessions",
    auto_calendar_events: "Calendar Events",
    auto_payments: "Payments",
    auto_attendance: "Attendance",
    auto_homework: "Homework",
    auto_exams: "Exams",
    auto_storage_recovered_cleanupre: "Storage Recovered: ${cleanupResults.storageRecoveredMb} MB",
    auto_done: "Done",
    auto_view: "View",
    auto_delete_all: "Delete All",
    auto_delete_this_record: "Delete this record",
    auto_zoom_link_is_required_for_onli: "Zoom link is required for online groups",
    auto_address_location_is_required: "Address / Location is required for offline groups",
    auto_refresh_data: "Refresh Data",
    auto_daily_inspiration: "Daily Inspiration",
    auto_teacher_reminder_motivation: "Teacher Reminder & Motivation",
    auto_another_message: "Another Message",
    auto_dismiss: "Dismiss",
    auto_quick_review: "Quick Review",
    auto_report_saved: "✓ Report saved",
    auto_1_attendance: "1. Attendance",
    auto_present: "✓ Present",
    auto_late: "⚠️ Late",
    auto_absent: "✕ Absent",
    auto_2_homework: "2. Homework",
    auto_completed: "Completed",
    auto_assigned: "Assigned",
    auto_not_completed: "Not completed",
    auto_3_teacher_notes: "3. Teacher Notes",
    auto_edit_report: "Edit Report",
    auto_before_starting: "Before Starting",
    auto_send_lesson_reminder: "Send Lesson Reminder",
    auto_open_zoom_link: "Open Zoom Link",
    auto_open_google_meet: "Open Google Meet",
    auto_send_lesson_started_notice: "Send Lesson Started Notice",
    auto_send_payment_request: "Send Payment Request",
    auto_open_google_maps_navigation: "Open Google Maps Navigation",
    auto_live_lesson_timer: "Live Lesson Timer",
    auto_completed_9: "Completed ✅",
    auto_cancelled: "Cancelled ✕",
    auto_in_progress: "In Progress 🟢",
    auto_paused: "Paused ⏸️",
    auto_scheduled: "Scheduled 📅",
    auto_duration_selectedlesson_dur: "Duration: ${selectedLesson.durationMinutes} min",
    auto_elapsed_time: "Elapsed Time",
    auto_start_session: "Start Session",
    auto_cancel_session: "Cancel Session",
    auto_resume_session: "Resume Session",
    auto_pause: "Pause",
    auto_confirm_lesson_cancellation: "Confirm Lesson Cancellation",
    auto_are_you_sure_you_want_to_cance: "Are you sure you want to cancel this lesson? The reason will be documented and saved.",
    auto_enter_cancellation_reason_opt: "Enter cancellation reason (optional)...",
    auto_back: "Back",
    auto_yes_cancel_lesson: "Yes, Cancel Lesson",
    auto_unified_session_report: "Unified Session Report",
    auto_hide_report: "Hide Report",
    auto_subject_taught_content_less: "Subject Taught (Content & Lessons Covered):",
    auto_enter_topics_taught_new_gramm: "Enter topics taught, new grammar rules, and vocabulary covered in the lesson...",
    auto_next_homework_assigned_to_stud: "Next Homework Assigned to Students:",
    auto_enter_details_of_homework_pag: "Enter details of homework, pages required, and exercises assigned for next lesson...",
    auto_status_performance_of_eac: "👥 Status & Performance of Each Student in the Group:",
    auto_previous_homework_lastse: "🎒 Previous Homework: ${lastSessionHwStatus === 'yes' ? 'Completed 👍' : 'Not Done 👎'}",
    auto_present_10: "Present ✅",
    auto_absent_11: "Absent ✕",
    auto_previous_homework_performance: "Previous Homework Performance:",
    auto_completed_12: "Completed 👍",
    auto_not_completed_13: "Not Completed 👎",
    auto_dictation_grade_out_of_10: "Dictation Grade (out of 10):",
    auto_exam_quiz_grade_out_of_10: "Exam/Quiz Grade (out of 10):",
    auto_parent_student_notes_option: "Parent & Student Notes (Optional):",
    auto_e_g_excellent_listening_skill: "e.g. Excellent listening skills today, needs review on question words...",
    auto_absent_exempt_from_grades: "✕ Absent - Exempt from grades and homework for this session",
    auto_please_complete_the_following: "Please complete the following fields to save the lesson:",
    auto_subject_taught_field: "Subject Taught field",
    auto_next_homework_field: "Next Homework field",
    auto_homework_status: "Homework Status",
    auto_dictation_grade: "Dictation Grade",
    auto_exam_grade: "Exam Grade",
    auto_student_14: "Student",
    auto_needs: "needs",
    auto: ", ",
    auto_end_session_save_report: "End Session & Save Report",
    auto_parent_communication: "Parent Communication:",
    auto_egp: "EGP",
    auto_back_to_settings: "Back to Settings",
    auto_notification_alert_settings: "Notification & Alert Settings",
    auto_sync_schedule: "Sync Schedule",
    auto_customize_all_system_notificat: "Customize all system notifications, lesson reminders, and device permissions",
    auto_no_pending_scheduled_notificat: "No pending scheduled notifications currently",
    auto_click_rebuild_schedules_to_p: "Click \"Rebuild Schedules\" to perform an immediate check and schedule upcoming lessons.",
    auto_automatic_system_alerts: "Automatic System Alerts",
    auto_mark_all_as_read: "Mark all as read",
    auto_clear_all: "Clear All",
    auto_no_new_notifications: "No new notifications.",
    auto_open_lesson: "Open Lesson",
    auto_completed_lesson_dates: "• Completed lesson dates",
    auto_flexible_prorated_billing: "Flexible & Prorated Billing",
    auto_you_can_end_the_current_cycle: "You can end the current cycle early for students and bill based on actually attended lessons.",
    auto_there_are_currently_no_student: "There are currently no students with completed unbilled lessons under the cycle limit.",
    auto_prorated_amount: "Prorated Amount",
    auto_attended_lessons: "Attended Lessons:",
    auto_lessons: "lessons",
    auto_force_cycle_bill: "Force Cycle & Bill",
    auto_force_end_current_cycle_bill: "Force End Current Cycle & Bill",
    auto_student_name_15: "Student Name:",
    auto_group_16: "Group:",
    auto_attendance_progress: "Attendance Progress:",
    auto_attended_proratemodalitem_le: "Attended ${prorateModalItem.lessonDates.length} of ${prorateModalItem.cycleLength} cycle lessons",
    auto_completed_lesson_dates_17: "Completed Lesson Dates:",
    auto_adjust_prorated_due_amount: "Adjust Prorated Due Amount:",
    auto_the_suggested_amount_is_calc: "* The suggested amount is calculated automatically based on per-lesson cost. You can adjust it manually before confirming.",
    auto_mark_as_unpaid_invoice: "Mark as Unpaid Invoice",
    auto_flexible_prorated_payment_p: "Flexible prorated payment (${prorateModalItem.lessonDates.length}/${prorateModalItem.cycleLength} lessons)",
    auto_mark_paid_now: "Mark Paid Now",
    auto_profile_work_schedule: "Profile & Work Schedule",
    auto_personal_information_contact: "Personal information, contact details & weekly availability",
    auto_payments_finance: "Payments & Finance",
    auto_financial_information_transfe: "Financial information, transfer methods & payment sharing",
    auto_messages_communication: "Messages & Communication",
    auto_automated_parent_communication: "Automated parent communication templates",
    auto_6_templates: "6 Templates",
    auto_notifications_alerts: "Notifications & Alerts",
    auto_reminders_lesson_alerts_dai: "Reminders, lesson alerts & daily summaries",
    auto_active: "Active",
    auto_disabled: "Disabled",
    auto_appearance_language: "Appearance & Language",
    auto_personalize_the_interface_expe: "Personalize the interface experience",
    auto_motivation_gratitude: "Motivation & Gratitude",
    auto_daily_inspiration_and_positive: "Daily inspiration and positive reminders",
    auto_daily: "Daily",
    auto_before_lesson: "Before Lesson",
    auto_random: "Random",
    auto_data_backup: "Data & Backup",
    auto_backup_restore_and_data_manag: "Backup, restore and data management",
    auto_about: "About",
    auto_application_information_and_ve: "Application information and version details",
    auto_select_a_section_to_manage_app: "Select a section to manage application settings",
    auto_search_settings: "Search settings...",
    auto_no_results_found: "No results found",
    auto_select_a_category: "Select a Category",
    auto_choose_a_category_from_the_sid: "Choose a category from the sidebar to view and manage its settings.",
    auto_language_appearance: "Language & Appearance",
    auto_choose_application_language_an: "Choose application language and theme mode",
    auto_note_the_selected_language_ap: "Note: The selected language applies to the entire application interface. Parent messages and reports always remain in Arabic.",
    auto_accent_color: "Accent Color",
    auto_select_your_preferred_accent_c: "Select your preferred accent color for all buttons, icons, active tabs, and interactive controls.",
    auto_teacher_profile: "Teacher Profile",
    auto_manage_personal_details_worki: "Manage personal details, working hours & currency",
    auto_edit_profile: "Edit Profile",
    auto_weekly_working_hours: "Weekly Working Hours",
    auto_sat: "Sat",
    auto_sun: "Sun",
    auto_mon: "Mon",
    auto_tue: "Tue",
    auto_wed: "Wed",
    auto_thu: "Thu",
    auto_fri: "Fri",
    auto_reminder_settings: "Reminder Settings",
    auto_in_app_lesson_alerts_within_3: "In-App Lesson Alerts (Within 30 mins)",
    auto_browser_push_notifications: "Browser Push Notifications",
    auto_payment_information: "Payment Information",
    auto_information_used_when_sending: "Information used when sending payment requests to parents",
    auto_direct_electronic_payment_prof: "Direct Electronic Payment Profile",
    auto_copy_payment_info: "Copy Payment Info",
    auto_parent_message_templates: "Parent Message Templates",
    auto_manage_templates_for_homework: "Manage templates for homework, attendance, absence, payment & reports",
    auto_absence: "Absence",
    auto_exam_reports: "Exam Reports",
    auto_lesson_summary: "Lesson Summary",
    auto_message_template_text_arabic: "Message Template Text (Arabic)",
    auto_available_dynamic_placeholders: "Available Dynamic Placeholders:",
    auto_reset_to_default: "Reset to Default",
    auto_save_templates: "Save Templates",
    auto_inspiration_gratitude: "Inspiration & Gratitude",
    auto_teacher_reminders_motivation: "Teacher reminders & motivation",
    auto_display_settings: "Display Settings",
    auto_frequency: "Frequency",
    auto_once_daily: "Once Daily",
    auto_before_first_lesson: "Before First Lesson",
    auto_randomly_during_day: "Randomly During Day",
    auto_display_method: "Display Method",
    auto_in_app_only_card: "In-App Only (Card)",
    auto_system_notification_only: "System Notification Only",
    auto_in_app_notification: "In-App & Notification",
    auto_message_source: "Message Source",
    auto_all_messages: "All Messages",
    auto_favorites_only: "Favorites Only",
    auto_test_reminder_now: "Test Reminder Now",
    auto_messages: "Messages",
    auto_manage_the_motivational_quotes: "Manage the motivational quotes and prayers. Add your own custom messages or favorite the ones you like.",
    auto_manage_messages: "Manage Messages",
    auto_all: "All",
    auto_favorites: "Favorites",
    auto_add_message: "Add Message",
    auto_restore_default_messages: "Restore Default Messages",
    auto_custom: "Custom",
    auto_are_you_sure: "Are you sure?",
    auto_no_messages_found: "No messages found",
    auto_edit_message: "Edit Message",
    auto_add_new_message: "Add New Message",
    auto_write_your_message: "Write your message...",
    auto_restore_defaults: "Restore Defaults",
    auto_default_messages_will_be_resto: "Default messages will be restored. Your custom messages will not be deleted.",
    auto_restore: "Restore",
    auto_backup_data_management_cente: "Backup & Data Management Center",
    auto_create_full_backups_password: "Create full backups, password encrypt, selectively restore & manage safety checkpoints",
    auto_smart_data_validation_health: "Smart Data Validation & Health Audit",
    auto_inspect_record_consistency_de: "Inspect record consistency, detect potential relationship or financial anomalies, and view data health score.",
    auto_open_data_audit_health_repor: "Open Data Audit & Health Report",
    auto_danger_zone_data_reset: "Danger Zone (Data Reset)",
    auto_sensitive_actions_resetting_d: "Sensitive actions: Resetting data will permanently delete all students, groups, lessons, and payment records.",
    auto_application_details_features: "Application details, features & developer contacts",
    auto_german_teacher_management_syst: "German Teacher Management System",
    auto_description: "Description",
    auto_features: "Features",
    auto_developer: "Developer",
    auto_please_select_at_least_one_cat: "Please select at least one category to export.",
    auto_gathering_and_preparing_backup: "Gathering and preparing backup payload...",
    auto_encrypting_payload_with_passwo: "Encrypting payload with password...",
    auto_backup_file_created_and_down: "✓ Backup file created and downloaded successfully!",
    auto_quick_backup_created_and_sav: "✓ Quick backup created and saved successfully!",
    auto_backup_failed: "❌ Backup failed: ",
    auto_all_data_restored_successful: "✓ All data restored successfully!",
    auto_failed_to_restore_data_plea: "❌ Failed to restore data. Please make sure to choose a valid JSON backup file.",
    auto_incorrect_password_or_corrupte: "Incorrect password or corrupted file.",
    auto_selected_categories_restored: "✓ Selected categories restored successfully with auto restore point!",
    auto_rollback_successful_restore: "✓ Rollback successful! Restored database to previous state.",
    auto_smart_backup_restore_center: "Smart Backup & Restore Center",
    auto_professional_data_management: "Professional data management, password encryption, selective restore & 1-click rollback",
    auto_undo_last_restore: "Undo last restore",
    auto_undo_last_restore_18: "Undo Last Restore",
    auto_1_tap_backup: "1-Tap Backup",
    auto_custom_export: "Custom Export",
    auto_custom_restore: "Custom Restore",
    auto_auto_backups: "Auto Backups",
    auto_restore_history: "Restore History",
    auto_instant_1_click_backup: "Instant 1-Click Backup",
    auto_export_and_save_a_complete_bac: "Export and save a complete backup containing all application data (teachers, students, groups, schedule, and financial records) in one simple tap.",
    auto_saving_and_sharing: "Saving and Sharing...",
    auto_tap_to_backup_save_everythin: "Tap to Backup & Save Everything",
    auto_instant_1_click_restore: "Instant 1-Click Restore",
    auto_select_a_backup_json_file_you: "Select a backup JSON file you downloaded previously to restore and replace all system data instantly. An automatic restore point will be saved first for safety.",
    auto_restoring_all_data: "Restoring All Data...",
    auto_choose_file_restore_all: "Choose File & Restore All",
    auto_automatic_data_protection: "Automatic Data Protection",
    auto_before_performing_any_restore: "Before performing any restore action, the app secures your current state. You can revert any restore process back to your previous state instantly by clicking the \"Undo Last Restore\" button above.",
    auto_select_all: "Select All",
    auto_deselect_all: "Deselect All",
    auto_full_backup_selected_100: "Full Backup Selected (100%)",
    auto_partial_selection_selectedc: "Partial Selection (${selectedCategories.length}/${ALL_BACKUP_CATEGORIES.length})",
    auto_full_backup_preview: "Full Backup Preview",
    auto_partial_backup_preview: "Partial Backup Preview",
    auto_payload_details_and_estimated: "Payload details and estimated size before export",
    auto_total_records: "Total Records",
    auto_groups: "Groups",
    auto_estimated_size: "Estimated Size",
    auto_estimated_time: "Estimated Time",
    auto_password_protect_encrypt_bac: "Password Protect & Encrypt Backup File",
    auto_enter_encryption_password: "Enter encryption password...",
    auto_this_password_will_be_required: "This password will be required when restoring this backup file.",
    auto_creating_backup_file: "Creating backup file...",
    auto_download_full_backup_json: "Download Full Backup (JSON)",
    auto_download_partial_backup_sel: "Download Partial Backup (${selectedCategories.length} categories)",
    auto_select_or_drop_backup_file_js: "Select or drop backup file (JSON)",
    auto_supports_standard_and_password: "Supports standard and password encrypted JSON backups",
    auto_browse_json_file: "Browse JSON File",
    auto_this_backup_file_is_password_p: "This backup file is password protected",
    auto_enter_password_to_unlock: "Enter password to unlock...",
    auto_unlock: "Unlock",
    auto_backup_type_analysis_backup: "Backup Type: ${analysis.backupType}",
    auto_verified_structure: "Verified Structure",
    auto_restore_mode: "Restore Mode",
    auto_smart_restore_default: "Smart Restore (Default)",
    auto_detect_duplicates_update_exis: "Detect duplicates, update existing, add missing, maintain links.",
    auto_merge_mode: "Merge Mode",
    auto_keep_current_data_add_importe: "Keep current data, add imported records without deletion.",
    auto_replace_mode: "Replace Mode",
    auto_replace_current_data_with_impo: "Replace current data with imported data for selected categories.",
    auto_categories_to_restore: "Categories to Restore",
    auto_select_all_available: "Select All Available",
    auto_restore_impact_report: "Restore Impact Report",
    auto_records_to_add: "Records to Add",
    auto_records_to_update: "Records to Update",
    auto_duplicates_detected: "Duplicates Detected",
    auto_potential_conflicts: "Potential Conflicts",
    auto_creating_restore_point_apply: "Creating Restore Point & Applying...",
    auto_warning_replace_mode_will_ove: "Warning: Replace Mode will overwrite current data!",
    auto_an_automatic_restore_point_sna: "An automatic Restore Point snapshot will be captured first so you can Undo anytime.",
    auto_confirm_replace_restore: "Confirm Replace & Restore",
    auto_restore_everything: "Restore Everything",
    auto_restore_selected_categories: "Restore Selected Categories (${selectedRestoreCategories.length})",
    auto_automatic_backup_retention_s: "Automatic Backup & Retention Schedule",
    auto_schedule_periodic_background_s: "Schedule periodic background snapshots & set retention limits",
    auto_daily_automatic_backup: "Daily Automatic Backup",
    auto_capture_a_daily_data_snapshot: "Capture a daily data snapshot upon app launch",
    auto_weekly_automatic_backup: "Weekly Automatic Backup",
    auto_capture_a_weekly_snapshot_auto: "Capture a weekly snapshot automatically",
    auto_monthly_automatic_backup: "Monthly Automatic Backup",
    auto_capture_a_monthly_snapshot_for: "Capture a monthly snapshot for record archives",
    auto_backup_retention_policy: "Backup Retention Policy",
    auto_keep_last_cnt: "Keep Last ${cnt}",
    auto_restore_operation_history: "Restore Operation History",
    auto_chronological_audit_log_of_all: "Chronological audit log of all previous restore operations",
    auto_no_restore_history_logged_yet: "No restore history logged yet.",
    auto_student_smart_card: "STUDENT SMART CARD",
    auto_active_19: "Active ✓",
    auto_archived: "Archived ⚪",
    auto_bearbeiten: "Bearbeiten",
    auto_l_schen: "Löschen",
    auto_call_parent: "Call Parent",
    auto_call_student: "Call Student",
    auto_overview: "Overview",
    auto_attendance_presentcount_l: "Attendance (${presentCount + lateCount + absentCount})",
    auto_grades_homework: "Grades & Homework",
    auto_files_student_documents_len: "Files (${student.documents.length})",
    auto_allgemeine_informationen: "ALLGEMEINE INFORMATIONEN",
    auto_import_group_students: "Import Group + Students",
    auto_no_students_yet: "No students yet.",
    auto_add_your_first_student_to_trac: "Add your first student to track attendance, lessons, and payments.",
    auto_parent: "Parent",
    auto_student_20: "Student",
    auto_options: "Options",
    auto_view_profile: "View Profile",
    auto_check_attendance: "Check Attendance",
    auto_scores_homework: "Scores & Homework",
    auto_payment_history: "Payment History",
    auto_send_whatsapp: "Send WhatsApp",
    auto_call_phone: "Call (Phone)",
    auto_delete_archive: "Delete / Archive",
    auto_no_groups_yet: "No groups yet.",
    auto_create_your_first_group_to_sta: "Create your first group to start organizing students and lessons.",
    auto_view_details: "View Details",
    auto_online: "Online",
    auto_center: "Center",
    auto_home: "Home",
    auto_private: "Private",
    auto_in_person: "In Person",
    auto_lesson: "Lesson",
    alert_add_zoom_link: "Please add the Zoom link for the group before sending the reminder.",
    alert_no_parent_phone: "No parent phone number registered. Please add the number in the student data.",
    alert_finish_lesson_first: "Please end the lesson first by clicking \"End Lesson and Save Report\" to open the parent report.",
    zoom_saved: "Saved",
    zoom_save_group: "Save for group",
    message_preview: "Message Preview",
    restore_original_text: "Restore original text",
    setup_subtitle: "German Teacher Assistant",
    setup_description: "Manage students, lessons, payments, homework and parent communication in one beautiful workspace.",
    settings_live_preview: "Live Preview",
    settings_primary_button: "Primary Button",
    settings_secondary_button: "Secondary",
    settings_premium_widget: "Premium Widget",
    settings_adapts_accent: "Adapts to your accent color",
    student_sitzungen: "SESSIONS",
    student_anwesend: "PRESENT",
    student_paketzyklus: "PACKAGE",
    student_doc_homework: "Homework File",
    student_doc_exam: "Exam File",
    student_doc_general: "Student Doc",
    student_notizen: "NOTES",},

  de: {
    notifications_title: 'Benachrichtigungen',
    free_time_available_today: 'Heute verfügbar',
    nav_home: 'Start',
    nav_schedule: 'Kalender',
    nav_students: 'Schüler',
    nav_history: 'Historie',
    nav_payments: 'Zahlungen',
    nav_reports: 'Berichte',
    nav_settings: 'Einstellungen',
    nav_quickLesson: 'Schnellstunde',
    nav_more: 'Mehr',
    nav_widgets: 'Android Widgets',
    goodMorning: 'Guten Morgen',
    goodAfternoon: 'Guten Tag',
    goodEvening: 'Guten Abend',
    greeting: 'Willkommen',
    refreshData: 'Daten aktualisieren',
    dataRefreshed: 'Daten erfolgreich aktualisiert',
    upcomingLessonAlert: 'Nächste Stunde',
    open: 'Öffnen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    add: 'Hinzufügen',
    search: 'Suchen',
    all: 'Alle',
    filter: 'Filtern',
    status: 'Status',
    date: 'Datum',
    time: 'Uhrzeit',
    notes: 'Notizen',
    confirm: 'Bestätigen',
    back: 'Zurück',
    close: 'Schließen',
    actions: 'Aktionen',
    copied: 'Kopiert',
    yes: 'Ja',
    no: 'Nein',
    archive: 'Archivieren',
    status_completed: 'Abgeschlossen',
    status_cancelled: 'Abgesagt',
    status_upcoming: 'Anstehend',
    status_in_progress: 'Laufend',
    status_pending: 'Ausstehend',
    status_scheduled: 'Geplant',
    att_present: 'Anwesend',
    att_absent: 'Abwesend',
    att_late: 'Verspätet',
    hw_assigned: 'Aufgegeben',
    hw_completed: 'Erledigt',
    hw_not_completed: 'Nicht erledigt',
    settings_title: 'Einstellungen und Konto',
    settings_sub: 'Konto, Oberflächensprache und Sicherung verwalten',
    settings_language: 'Oberflächensprache',
    settings_lang_desc: 'Wählen Sie die Sprache für die App-Oberfläche',
    settings_parent_comm_notice: 'Hinweis: Elternberichte und Nachrichten werden immer auf Arabisch erstellt.',
    settings_theme: 'Erscheinungsbild',
    settings_theme_light: 'Heller Modus',
    settings_theme_dark: 'Dunkler Modus',
    settings_profile: 'Lehrerprofil',
    settings_name: 'Lehrername',
    settings_email: 'E-Mail',
    settings_currency: 'Währung',
    settings_working_hours: 'Arbeitszeiten',
    settings_start_time: 'Startzeit',
    settings_end_time: 'Endzeit',
    settings_payment_details: 'Zahlungsdaten',
    settings_phone: 'Telefonnummer',
    settings_instapay: 'InstaPay ID',
    settings_vodafone: 'Vodafone Cash',
    settings_bank: 'Bankkonto',
    settings_payment_link: 'Zahlungslink',
    settings_share_payment: 'Zahlungsdaten kopieren',
    settings_backup: 'Sicherung und Wiederherstellung',
    settings_download_backup: 'Sicherung herunterladen',
    settings_restore_backup: 'Aus Datei wiederherstellen',
    settings_clear_data: 'Alle Daten löschen',
    settings_save_success: 'Änderungen erfolgreich gespeichert',
    schedule_title: 'Stundenplan',
    schedule_today: 'Heute',
    schedule_week: 'Woche',
    schedule_month: 'Monat',
    schedule_add_lesson: 'Stunde hinzufügen',
    schedule_start_now: 'Jetzt Stunde starten',
    schedule_no_lessons: 'Keine Stunden geplant',
    schedule_conflict: 'Konflikt',
    schedule_working_hours: 'Arbeitszeiten',
    schedule_refresh: 'Aktualisieren',
    schedule_ical: 'Kalender exportieren',
    schedule_no_conflicts: 'Keine Zeitkonflikte',
    schedule_day_view: 'Tagesansicht',
    schedule_week_view: 'Wochenansicht',
    schedule_month_view: 'Monatsansicht',
    schedule_reschedule: 'Termin verschieben',
    schedule_new_date: 'Neues Datum',
    schedule_new_time: 'Neue Uhrzeit',
    schedule_conflict_alert: 'Achtung: Zeitkonflikt für diesen Termin entdeckt',
    schedule_reschedule_success: 'Termin erfolgreich verschoben',
    schedule_weekly: 'Wöchentlich',
    schedule_no_lessons_day: 'Keine Stunden für diesen Tag geplant',
    schedule_add_lesson_for: 'Neue Stunde hinzufügen',
    lesson_control_title: 'Stundenverwaltung',
    lesson_timer: 'Live-Timer',
    lesson_duration: 'Dauer',
    lesson_start: 'Stunde starten',
    lesson_resume: 'Fortsetzen',
    lesson_pause: 'Pausieren',
    lesson_end: 'Stunde beenden',
    lesson_cancel: 'Stunde absagen',
    lesson_report_form: 'Stundenbericht',
    lesson_show_timer: 'Timer anzeigen',
    lesson_attendance: 'Anwesenheit',
    lesson_homework: 'Hausaufgabe',
    lesson_teacher_notes: 'Lehrernotizen',
    lesson_parent_report_btn: 'Elternbericht',
    lesson_save_report: 'Bericht speichern',
    students_title: 'Schüler und Gruppen',
    students_tab_all: 'Alle Schüler',
    students_tab_groups: 'Gruppen',
    students_add_student: '+ Schüler',
    students_add_group: '+ Gruppe',
    students_search_placeholder: 'Schüler, Eltern oder Telefon suchen...',
    students_search_group_placeholder: 'Gruppe suchen...',
    students_group_name: 'Gruppenname',
    students_student_name: 'Schülername',
    students_grade: 'Klassenstufe',
    students_parent_phone: 'Telefon der Eltern',
    students_student_phone: 'Telefon des Schülers',
    students_package: 'Paket',
    students_no_students: 'Noch keine Schüler',
    students_no_groups: 'Noch keine Gruppen',
    students_group: 'Gruppe',
    students_individual: 'Einzel',
    students_active: 'Aktiv',
    students_archived: 'Archiviert',
    students_lessons_count: 'Anzahl Stunden',
    students_phone: 'Telefon',
    students_parent_phone_label: 'Eltern',
    students_details: 'Details',
    students_all_grades: 'Alle Grade',
    students_no_students_found: 'Keine Schüler gefunden.',
    students_all_days: 'Alle Tage',
    students_today: 'Heute',
    students_archive_info: 'Archivierte Schüler und Gruppen bleiben in der Historie gespeichert. Sie können jederzeit reaktiviert werden.',
    students_archived_students_title: 'Archivierte Schüler',
    students_no_archived_students: 'Keine archivierten Schüler.',
    students_archived_groups_title: 'Archivierte Gruppen',
    students_no_archived_groups: 'Keine archivierten Gruppen.',
    students_restore: 'Wiederherstellen',
    students_reset_filters: 'Filter zurücksetzen',
    history_title: 'Unterrichtshistorie',
    history_header_sub: 'Anzeige und Verwaltung des Archivs aller vergangenen Sitzungen und Berichte',
    history_total_lessons: 'Gesamtstunden',
    history_completed: 'Abgeschlossen',
    history_cancelled_missed: 'Abgesagt / Abwesend',
    history_total_hours: 'Gesamtstunden',
    history_filter_all: 'Alle',
    history_filter_completed: 'Abgeschlossen',
    history_filter_cancelled: 'Abgesagt',
    history_filter_pending: 'Ausstehend',
    history_search_placeholder: 'Stunden nach Schüler, Gruppe oder Thema suchen...',
    history_search: 'Historie durchsuchen',
    history_export: 'Historie exportieren',
    history_filter_entity_label: 'Nach Schüler / Gruppe filtern:',
    history_all_entities: 'Alle Schüler und Gruppen',
    history_groups_category: 'Gruppen',
    history_students_category: 'Schüler',
    history_filter_period_label: 'Zeitraum:',
    history_period_all: 'Alle Zeiten',
    history_period_today: 'Heute',
    history_period_this_week: 'Diese Woche',
    history_period_this_month: 'Diesen Monat',
    history_results_count: 'Ergebnisse ({count} Stunden)',
    history_reset_filters: 'Filter zurücksetzen',
    payments_title: 'Zahlungsverwaltung',
    payments_total_collected: 'Eingenommen',
    payments_total_pending: 'Ausstehend',
    payments_completed_cycle: 'Abgeschlossener Zyklus',
    payments_daily_summary: 'Tagesübersicht',
    payments_details_heading: 'Details',
    payments_due_tab: 'Fällig',
    payments_history_sub: 'Verlauf der Zahlungen',
    payments_monthly_summary: 'Monatsübersicht',
    payments_no_cycles_period: 'Keine bezahlten Zyklen.',
    payments_no_due_sub: 'Derzeit keine fälligen Zahlungen.',
    payments_not_yet_btn: 'Noch nicht',
    payments_paid_btn: 'Bezahlt',
    payments_parent_notice: 'Elternnotiz',
    payments_pending_tag: 'Ausstehend',
    payments_weekly_summary: 'Wochenübersicht',
    payments_daily_gain: 'Tagesumsatz',
    payments_weekly_gain: 'Wochenumsatz',
    payments_monthly_gain: 'Monatsumsatz',
    payments_overdue: 'Überfällig',
    payments_expected: 'Erwartet',
    payments_revenue_overview: 'Umsatzübersicht',
    payments_record: 'Zahlung erfassen',
    payments_send_reminder: 'Erinnerung senden',
    payments_paid: 'Bezahlt',
    payments_unpaid: 'Offen',
    payments_partial: 'Teilweise bezahlt',
    payments_collected: 'Eingenommen',
    payments_pending: 'Ausstehend',
    payments_plan: 'Zahlungsplan',
    payments_history: 'Zahlungsverlauf',
    payments_method: 'Zahlungsart',
    payments_due_date: 'Fälligkeitsdatum',
    payments_daily: 'Täglich:',
    payments_weekly: 'Wöchentlich:',
    payments_monthly: 'Monatlich:',
    payments_total_pending_label: 'Gesamt Ausstehend',
    payments_open_tab: 'Offene Zahlungen',
    payments_history_tab: 'Zahlungshistorie',
    payments_all_groups: 'Alle Gruppen',
    payments_no_due_title: 'Keine fälligen Zahlungen vorhanden ✨',
    payments_no_due_desc: 'Alle Schüler sind aktuell auf dem neuesten Stand. Schüler erscheinen hier automatisch erst dann, wenn sie ihren Zahlungszyklus (z. B. 4/4 oder 8/8 Lektionen) vollständig abgeschlossen haben.',
    payments_completed_dates_label: 'Meldungen / Abgeschlossene Termine:',
    payments_pending_expectation: '(In Erwartung ⏳)',
    payments_amount_due: 'Fälliger Betrag',
    payments_mark_paid: 'تم السداد (Paid)',
    payments_mark_not_yet: 'لم يتم بعد (Not Yet)',
    payments_notify_parent_wa: 'Eltern benachrichtigen (WhatsApp)',
    payments_no_history: 'Keine bezahlten Historien-Einträge vorhanden',
    payments_history_auto_archive: 'Bezahlte Zyklen werden hier automatisch archiviert.',
    payments_paid_on: 'Bezahlt am:',
    payments_notice_title: 'Zahlungserinnerung an Eltern',
    payments_copy_text: 'Text kopieren',
    payments_copied: 'Kopiert! ✓',
    payments_open_whatsapp: 'WhatsApp öffnen',
    payments_daily_gain_title: 'Tageseinnahmen (Heute)',
    payments_weekly_gain_title: 'Wocheneinnahmen (Letzte 7 Tage)',
    payments_monthly_gain_title: 'Monatseinnahmen (Diesen Monat)',
    payments_gain_summary_sub: 'Einnahmen-Zusammenfassung & Bezahlte Zyklen',
    payments_total_gains: 'Gesamteinnahmen',
    payments_paid_cycles: 'Bezahlte Zyklen',
    payments_details_header: 'Details der Zahlungen',
    payments_no_paid_period: 'Keine bezahlten Zyklen in diesem Zeitraum erfasst.',
    reports_title: 'Berichte & Analysen',
    reports_header_sub: 'Sitzungen, wöchentliche Einnahmen & Bezahlungs-Kontrolle',
    reports_print_pdf: 'Drucken / PDF',
    reports_collected_revenue: 'Erhaltene Einnahmen',
    reports_from_paid_sessions: 'Aus Sitzungen bezahlt',
    reports_unpaid_amount: 'Offener Betrag',
    reports_pending_payments: 'Ausstehende Zahlungen',
    reports_sessions_completed: 'Sitzungen Absolviert',
    reports_total_conducted: 'Insgesamt durchgeführt',
    reports_unpaid_last_sessions: 'Letzte Sitzung Unbezahlt',
    reports_urgent_collect: '⚠️ Dringend kassieren!',
    reports_all_good: 'Alles im grünen Bereich',
    reports_weekly_protocol: 'Wöchentliches Sitzungs- & Einnahmen-Protokoll',
    reports_weekly_protocol_sub: 'Jede Sitzung mit erhaltenem Honorar und Bezahlungs-Warnungen',
    reports_filter_all: 'Alle',
    reports_filter_this_week: 'Diese Woche',
    reports_filter_paid: 'Bezahlt',
    reports_filter_unpaid: 'Unbezahlt',
    reports_no_sessions_filter: 'Keine Sitzungen für die ausgewählte Filteroption gefunden.',
    reports_weekly_chart_title: 'Wöchentlicher Umsatzvergleich',
    reports_attendance_overview_title: 'Anwesenheitsübersicht der Schüler',
    reports_total_lessons: 'Gesamtstunden',
    reports_active_students: 'Aktive Schüler',
    reports_attendance_rate: 'Anwesenheitsquote',
    reports_lessons_completed: 'Abgeschlossene Stunden',
    reports_revenue: 'Einnahmen',
    reports_students: 'Anzahl Schüler',
    reports_export_pdf: 'PDF-Bericht exportieren',
    daily_stats_lessons_today: 'Stunden heute',
    daily_stats_students_today: 'Schüler heute',
    daily_stats_revenue_today: 'Umsatz heute',
    daily_stats_completed: 'Abgeschlossen',
    daily_stats_monthly_overview: 'Monatlicher Überblick',
    daily_stats_students: 'Schüler',
    daily_stats_groups: 'Gruppen',
    daily_stats_completed_short: 'Abgeschlossen',
    daily_stats_revenue: 'Umsatz',
    tomorrows_lessons_title: 'Stunden morgen',
    no_lessons_tomorrow: 'Keine Stunden für morgen geplant ✨',
    weekly_overview_title: 'Wöchentliche Übersicht',
    weekly_overview_sub: 'Freitag - Donnerstag',
    stat_remaining: 'Verbleibend',
    stat_cancelled: 'Storniert',
    stat_uncollected: 'Ausstehend',
    stat_total_expected: 'Gesamt erwartet',
    smart_summary_title: 'Kluge Tageszusammenfassung',
    smart_summary_badge: 'Kluges Update',
    smart_summary_today: 'Heute',
    smart_summary_expected_income: 'Erwartete Einnahmen',
    smart_summary_first_lesson: 'Erste Stunde',
    smart_summary_overdue_students: 'Überfällige Schüler',
    smart_summary_todays_lessons: 'Stunden heute',
    smart_summary_todays_students: 'Schüler heute',
    smart_summary_no_lessons_regular: 'Keine Stunden für heute geplant. Alle Zahlungen sind aktuell ✨',
    next_action_title: 'NÄCHSTE STUNDE',
    next_action_no_lessons: 'Keine bevorstehenden Stunden für den gewählten Filter',
    next_action_today: 'Heute',
    next_action_tomorrow: 'Morgen',
    next_action_this_week: 'Diese Woche',
    next_action_all: 'Alle',
    next_action_online: 'Online',
    next_action_offline: 'Offline',
    next_action_open: 'Stunde öffnen',
    time_in_progress: 'Läuft gerade',
    time_starts_in: 'Startet demnächst',
    time_starts_at: 'Startet um',
    time_scheduled_today: 'Heute geplant',
    timeline_title: 'Heutige Lektionen',
    todays_lessons_title: 'Heutige Lektionen (Today\'s Lessons)',
    timeline_pending_action: 'Vergangene ausstehende Lektionen',
    past_pending_lessons_title: 'Vergangene ausstehende Lektionen (Past Pending Lessons)',
    past_pending_lessons_desc: 'Alte Lektionen aus vergangenen Tagen ohne aktiven Status:',
    timeline_requires_action: 'Aktion erforderlich',
    timeline_pending_desc: 'Diese früheren Stunden wurden noch nicht abgeschlossen:',
    timeline_no_lessons: 'Keine Stunden für heute geplant',
    timeline_completed_of: 'Stunden abgeschlossen',
    timeline_live_now: 'JETZT LIVE',
    timeline_upcoming: 'Anstehend',
    timeline_group: 'Gruppe',
    timeline_individual: 'Einzel',
    system_time: 'Systemzeit',
    sofort_badge: 'Sofort-Lektion starten',
    sofort_title: 'Start Lesson Now (Jederzeit starten)',
    sofort_desc: 'Starten Sie eine Lektion sofort für jede Gruppe, unabhängig vom Stundenplan.',
    quick_lesson_modal_title: 'Schnelle Lektion (Quick Lesson)',
    quick_lesson_modal_desc: 'Für Test- / Einzellerne ohne Profil',
    students_and_groups_title: 'Schüler & Gruppen',
    session_history_modal_title: 'Sitzungshistorie (Session History)',
    daily_gain_label: 'Täglich:',
    weekly_gain_label: 'Wöchentlich:',
    monthly_gain_label: 'Monatlich:',
    open_payments_tab: 'Offene Zahlungen',
    payment_history_tab: 'Zahlungshistorie',
    all_groups_option: 'Alle Gruppen',
    no_due_payments_title: 'Keine fälligen Zahlungen vorhanden ✨',
    no_due_payments_desc: 'Alle Schüler sind aktuell auf dem neuesten Stand. Schüler erscheinen hier automatisch erst dann, wenn sie ihren Zahlungszyklus (z. B. 4/4 oder 8/8 Lektionen) vollständig abgeschlossen haben.',
    dismiss_from_dashboard: 'Aus Dashboard ausblenden',
    todo_widget_title: 'To-Do',
    todo_add_placeholder: 'Schnelle Aufgabe hinzufügen...',
    todo_no_tasks: 'Keine ausstehenden Aufgaben ✨',
    todo_add_btn: 'Hinzufügen',
    reports_and_analytics_title: 'Berichte & Analysen',
    nav_free_time: 'Freie Zeit',
    add_group_title: 'Neue Gruppe hinzufügen',
    add_group_subtitle: 'Gruppendetails und Monatspaket eingeben',
    lesson_duration_label: 'Lektionsdauer',
    schedule_lesson_title: 'Neue Lektion planen',
    save_lesson_btn: 'Lektion speichern',
    duplicate_student_warning: 'Ein Schüler mit demselben Namen existiert bereits in dieser Gruppe. Möchten Sie fortfahren?',
    students_all_groups: 'Alle Gruppen',
    payments_no_due: 'Keine fälligen Zahlungen',
    payment_plan_lessons: 'Lektionen',
    payments_completed_dates: 'Abgeschlossene Termine',
    reports_copied: 'Bericht kopiert',
    reports_and_analyses: 'Berichte & Analysen',
    lesson_session_num: 'Lektionsnummer',
    daily_stats_student: 'Schüler',
    todo_more_tasks: 'weitere Aufgaben...',
  
    auto_please_enter_student_name: "Bitte Schülernamen eingeben",
    auto_parent_phone_number_is_require: "Telefonnummer der Eltern ist für den Schüler erforderlich",
    auto_import_group_students_with_a: "Import Group + Students with AI",
    auto_create_group_and_all_students: "Create group and all students at once with AI text",
    auto_ai_import: "AI Import",
    auto_create_a_student_for_this_grou: "Schüler für diese Gruppe erstellen (Privatunterricht 1:1)",
    auto_initial_student_information: "Schülerinformationen",
    auto_student_name: "Schüler Name *",
    auto_e_g_ahmed_ali: "z. B. Ahmed Ali",
    auto_parent_name: "Name des Erziehungsberechtigten",
    auto_e_g_ali_mahmoud: "z. B. Ali Mahmoud",
    auto_parent_phone: "Telefon Eltern",
    auto_grade: "Klassenstufe",
    auto_student_notes: "Lernnotizen",
    auto_additional_student_notes: "Besondere Schwerpunkte...",
    auto_save_group: "Gruppe speichern",
    auto_parent_phone_number_is_require_1: "Telefonnummer der Eltern ist erforderlich",
    auto_add_new_student: "Neuen Schüler anlegen",
    auto_automatic_group_pricing_inheri: "Automatische Gruppenpreisvererbung",
    auto_assigned_group: "Gruppe / Kurs zuweisen *",
    auto_inherited_pricing: "Automatischer Preisschlüssel:",
    auto_package: "Package: ",
    auto_sessions: "Sitzungen",
    auto_inherited_automatically_from: " Preis wird automatisch von ${selectedGroup.name} übernommen.",
    auto_grade_level: "Klassenstufe",
    auto_parent_phone_2: "Telefon Eltern *",
    auto_student_phone_optional: "Telefon Schüler (Optional)",
    auto_special_focus_notes_or_weakn: "Besondere Schwerpunkte, Schwächen oder Vorkenntnisse...",
    auto_save_student: "Schüler Speichern",
    auto_import_group_students_ai_te: "Import Group + Students (AI Template)",
    auto_create_an_entire_group_and_all: "Create an entire group and all students in one step",
    auto_group_students_imported_succ: "Group & Students Imported Successfully!",
    auto_group_name: "Group Name:",
    auto_grade_level_3: "Grade Level:",
    auto_students_imported: "Students Imported:",
    auto_students: "Students",
    auto_schedule: "Schedule:",
    auto_view_group_profile: "View Group Profile",
    auto_close: "Schließen",
    auto_copy_prompt_orders_for_ai: "Copy Prompt / Orders for AI",
    auto_prompt_copied: "Prompt Copied!",
    auto_copy_ai_prompt_orders: "Copy AI Prompt Orders",
    auto_copied: "Kopiert!",
    auto_sample_data: "Sample Data",
    auto_click_copy_ai_prompt_orders: "Click \"Copy AI Prompt Orders\" and paste it into ChatGPT/Gemini along with your raw group list/notes. Then copy the AI response and paste it into the box below.",
    auto_ai_generated_text: "AI Generated Text:",
    auto_strict_zero_data_loss_validati: "Strict Zero-Data-Loss Validation",
    auto_all_fields_validated_success: "✓ All fields validated successfully. Ready for import.",
    auto_data_preview_before_import: "Data Preview Before Import:",
    auto_students_4: "students",
    auto_group_name_5: "Group Name",
    auto_grade_type: "Grade & Type",
    auto_days_time: "Days & Time",
    auto_zoom_link: "Zoom Link",
    auto_address: "Address",
    auto_student_name_6: "Student Name",
    auto_parent_phone_req: "Parent Phone (Req)",
    auto_student_phone_opt: "Student Phone (Opt)",
    auto_cancel: "Cancel",
    auto_confirm_import: "Confirm Import",
    auto_share_session_report: "Unterrichtsbericht teilen",
    auto_bulk_group_report_groups: "📊 Sammelbericht für Gruppe (${groupStudents.length} Schüler)",
    auto_individual_student_report: "👤 Einzelner Schülerbericht",
    auto_select_a_student_to_preview: "👥 Wählen Sie einen Schüler für die Vorschau aus:",
    auto_student: "👤 Schüler:",
    auto_not_specified: "Nicht angegeben",
    auto_parent_phone_7: "📱 Eltern-Telefon:",
    auto_not_registered: "Nicht registriert",
    auto_group: "👥 Gruppe:",
    auto_german_group: "Deutschgruppe",
    auto_whatsapp_group_connected: "WhatsApp-Gruppe verbunden ✅",
    auto_group_link_not_linked_yet: "⚠️ Gruppenlink noch nicht verknüpft",
    auto_tip_you_can_edit_the_group_to: "Tipp: Sie können die Gruppe bearbeiten, um den \"WhatsApp-Gruppenlink\" der Eltern einzugeben und diesen Sammelbericht mit einem Klick zu senden!",
    auto_preview_edit_message: "Nachrichtenvorschau & Bearbeitung:",
    auto_copy_text: "Copy Text",
    auto_send_to_whatsapp_group: "An WhatsApp-Gruppe senden",
    auto_send_via_whatsapp: "Über WhatsApp senden",
    auto_print: "Drucken",
    auto_phone_call: "Telefonanruf",
    auto_go_to_homescreen: "Startseite",
    auto_free_hours: "Freie Stunden",
    auto_slots: "Slots",
    auto_next_slot: "Nächster",
    auto_none: "Keiner",
    auto_excellent: "🟢 Ausgezeichnet",
    auto_needs_cleanup: "🟡 Wartung erforderlich",
    auto_critical: "🔴 Kritisch",
    auto_students_without_group: "Schüler ohne Gruppe",
    auto_sessions_without_group: "Sitzungen ohne Gruppe",
    auto_calendar_sessions_without_grou: "Kalenderevents ohne Gruppe",
    auto_payments_without_group: "Zahlungen ohne Gruppe",
    auto_attendance_records_without_gro: "Anwesenheit ohne Gruppe",
    auto_homework_records_without_group: "Hausaufgaben ohne Gruppe",
    auto_exam_records_without_group: "Prüfungen ohne Gruppe",
    auto_data_health_center: "Daten-Gesundheitszentrum",
    auto_last_scan_lastscantime: "Letzter Scan: ${lastScanTime}",
    auto_scan_database: "Scan durchführen",
    auto_data_health_summary: "Zusammenfassung der Datengesundheit",
    auto_database_health_score: "Gesundheitswert",
    auto_healthy_records: "Gesunde Datensätze",
    auto_orphaned_records: "Isolierte Datensätze",
    auto_storage_used: "Speicherplatz",
    auto_clean_all_orphan_data: "Alle isolierten Daten bereinigen",
    auto_data_integrity_cleanup: "Integrität & Datenbereinigung",
    auto_detect_unlinked_orphaned_data: "Verwaiste Daten erkennen",
    auto_1_students_without_group: "1. Schüler ohne Gruppe",
    auto_student_records_whose_groupid: "Schüler ohne gültige Gruppenzuweisung.",
    auto_2_sessions_without_group: "2. Sitzungen ohne Gruppe",
    auto_lesson_sessions_whose_groupid: "Unterrichtssitzungen ohne zugewiesene Gruppe.",
    auto_3_calendar_sessions_without_g: "3. Kalenderevents ohne Gruppe",
    auto_calendar_events_whose_groupid: "Geplante Kalendertermine ohne gültige Gruppe.",
    auto_4_payments_without_group: "4. Zahlungen ohne Gruppe",
    auto_payment_records_linked_to_miss: "Zahlungsdatensätze ohne verknüpfte Gruppe.",
    auto_5_attendance_records_without: "5. Anwesenheit ohne Gruppe",
    auto_attendance_records_linked_to_m: "Anwesenheitseinträge ohne zugewiesene Gruppe.",
    auto_6_homework_records_without_gr: "6. Hausaufgaben ohne Gruppe",
    auto_homework_records_linked_to_mis: "Hausaufgabeneinträge ohne verknüpfte Gruppe.",
    auto_7_exam_quiz_records_without_g: "7. Prüfungen ohne Gruppe",
    auto_exam_results_linked_to_missing: "Prüfungsergebnisse ohne zugewiesene Gruppe.",
    auto_profile_field_integrity: "Profilvollständigkeit",
    auto_students_with_complete_data: "Schüler mit vollständigen Daten",
    auto_students_missing_parent_phone: "Students missing parent phone",
    auto_fix_now: "Fix Now",
    auto_groups_missing_schedule: "Groups missing schedule",
    auto_groups_missing_session_price: "Groups missing session price",
    auto_online_groups_missing_zoom_lin: "Online groups missing Zoom link",
    auto_offline_groups_missing_locatio: "Offline groups missing location address",
    auto_total_orphaned_records_getc: "Verwaiste Einträge: ${getCategoryCount(viewCategory)}",
    auto_no_orphaned_records_in_this_ca: "Keine verwaisten Einträge in dieser Kategorie!",
    auto_delete_all_in_category: "Alle in dieser Kategorie löschen",
    auto_cleanup_orphan_data: "⚠️ Verwaiste Daten bereinigen",
    auto_the_selected_records_are_not_l: "Die ausgewählten Datensätze sind mit keiner bestehenden Gruppe verknüpft.",
    auto_records_to_delete_singledel: "Zu löschende Datensätze: ${singleDeleteItemId ? 1 : confirmDeleteTarget === 'all' ? totalOrphanedRecords : getCategoryCount(confirmDeleteTarget)}",
    auto_this_action_cannot_be_undone: "Diese Aktion kann nicht rückgängig gemacht werden.",
    auto_delete_permanently: "Endgültig löschen",
    auto_cleanup_complete: "Bereinigung abgeschlossen",
    auto_dashboard_views_automaticall: "Ansichten automatisch aktualisiert",
    auto_deleted_records_breakdown: "Gelöschte Datensätze:",
    auto_sessions_8: "Sitzungen",
    auto_calendar_events: "Kalendertermine",
    auto_payments: "Zahlungen",
    auto_attendance: "Attendance",
    auto_homework: "Homework",
    auto_exams: "Prüfungen",
    auto_storage_recovered_cleanupre: "Freigegebener Speicher: ${cleanupResults.storageRecoveredMb} MB",
    auto_done: "Fertig",
    auto_view: "Anzeigen",
    auto_delete_all: "Alle löschen",
    auto_delete_this_record: "Diesen Eintrag löschen",
    auto_zoom_link_is_required_for_onli: "Zoom-Link ist für Online-Gruppen erforderlich",
    auto_address_location_is_required: "Adresse / Ort ist für Offline-Gruppen erforderlich",
    auto_refresh_data: "Daten aktualisieren",
    auto_daily_inspiration: "Tägliche Inspiration",
    auto_teacher_reminder_motivation: "Teacher Reminder & Motivation",
    auto_another_message: "Another Message",
    auto_dismiss: "Dismiss",
    auto_quick_review: "Kurze Zusammenfassung",
    auto_report_saved: "✓ Bericht gespeichert",
    auto_1_attendance: "1. Anwesenheit",
    auto_present: "✓ Anwesend",
    auto_late: "⚠️ Verspätet",
    auto_absent: "✕ Abwesend",
    auto_2_homework: "2. Hausaufgaben",
    auto_completed: "Erledigt",
    auto_assigned: "Aufgegeben",
    auto_not_completed: "Nicht erledigt",
    auto_3_teacher_notes: "3. Lehrernotizen",
    auto_edit_report: "Bericht bearbeiten",
    auto_before_starting: "Vor Unterrichtsbeginn",
    auto_send_lesson_reminder: "Lektionserinnerung senden",
    auto_open_zoom_link: "Zoom-Link öffnen",
    auto_open_google_meet: "Google Meet öffnen",
    auto_send_lesson_started_notice: "Unterrichtsbeginn senden",
    auto_send_payment_request: "Zahlungsaufforderung senden",
    auto_open_google_maps_navigation: "Google Maps Navigation öffnen",
    auto_live_lesson_timer: "Live-Unterrichts-Timer",
    auto_completed_9: "Abgeschlossen ✅",
    auto_cancelled: "Storniert ✕",
    auto_in_progress: "In Bearbeitung 🟢",
    auto_paused: "Pausiert ⏸️",
    auto_scheduled: "Geplant 📅",
    auto_duration_selectedlesson_dur: "Dauer: ${selectedLesson.durationMinutes} Min",
    auto_elapsed_time: "Vergangene Zeit",
    auto_start_session: "Unterricht starten",
    auto_cancel_session: "Unterricht stornieren",
    auto_resume_session: "Fortsetzen",
    auto_pause: "Pausieren",
    auto_confirm_lesson_cancellation: "Stornierung der Lektion bestätigen",
    auto_are_you_sure_you_want_to_cance: "Sind Sie sicher, dass Sie diese Lektion stornieren möchten? Der Grund wird dokumentiert.",
    auto_enter_cancellation_reason_opt: "Stornierungsgrund eingeben (optional)...",
    auto_back: "Back",
    auto_yes_cancel_lesson: "Ja, Lektion stornieren",
    auto_unified_session_report: "Einheitlicher Unterrichtsbericht",
    auto_hide_report: "Bericht ausblenden",
    auto_subject_taught_content_less: "Behandelter Stoff (Inhalt & durchgegangene Lektionen):",
    auto_enter_topics_taught_new_gramm: "Geben Sie die erklärten Themen, neue Grammatikregeln und den behandelten Wortschatz ein...",
    auto_next_homework_assigned_to_stud: "Nächste Hausaufgabe für die Schüler:",
    auto_enter_details_of_homework_pag: "Geben Sie Details zu Hausaufgaben, benötigten Seiten und zugewiesenen Übungen für die nächste Stunde ein...",
    auto_status_performance_of_eac: "👥 Status & Leistung jedes Schülers in der Gruppe:",
    auto_previous_homework_lastse: "🎒 Letzte Hausaufgabe: ${lastSessionHwStatus === 'yes' ? 'Erledigt 👍' : 'Nicht erledigt 👎'}",
    auto_present_10: "Anwesend ✅",
    auto_absent_11: "Abwesend ✕",
    auto_previous_homework_performance: "Vorherige Hausaufgabenleistung:",
    auto_completed_12: "Erledigt 👍",
    auto_not_completed_13: "Nicht erledigt 👎",
    auto_dictation_grade_out_of_10: "Diktatnote (von 10):",
    auto_exam_quiz_grade_out_of_10: "Prüfungs-/Quiznote (von 10):",
    auto_parent_student_notes_option: "Eltern- & Schülernotizen (Optional):",
    auto_e_g_excellent_listening_skill: "z.B. Heute hervorragend beim Hören, muss Fragewörter wiederholen...",
    auto_absent_exempt_from_grades: "✕ Abwesend - Befreit von Noten und Hausaufgaben für diese Stunde",
    auto_please_complete_the_following: "Bitte füllen Sie die folgenden Felder aus, um die Stunde zu speichern:",
    auto_subject_taught_field: "Feld \"Behandelter Stoff\"",
    auto_next_homework_field: "Feld \"Nächste Hausaufgabe\"",
    auto_homework_status: "Hausaufgabenstatus",
    auto_dictation_grade: "Diktatnote",
    auto_exam_grade: "Prüfungsnote",
    auto_student_14: "Schüler",
    auto_needs: "benötigt",
    auto: ", ",
    auto_end_session_save_report: "Stunde beenden & Bericht speichern",
    auto_parent_communication: "Eltern-Kommunikation:",
    auto_egp: "EGP",
    auto_back_to_settings: "Back to Settings",
    auto_notification_alert_settings: "Benachrichtigungseinstellungen",
    auto_sync_schedule: "Zeitplan synchronisieren",
    auto_customize_all_system_notificat: "Systembenachrichtigungen, Lektionserinnerungen und Geräteeinstellungen anpassen",
    auto_no_pending_scheduled_notificat: "Derzeit keine ausstehenden Benachrichtigungen",
    auto_click_rebuild_schedules_to_p: "Klicken Sie auf \"Zeitpläne neu erstellen\", um anstehende Lektionen zu planen.",
    auto_automatic_system_alerts: "Automatische Systemalarme",
    auto_mark_all_as_read: "Alle als gelesen markieren",
    auto_clear_all: "Alle löschen",
    auto_no_new_notifications: "Keine neuen Benachrichtigungen.",
    auto_open_lesson: "Lektion öffnen",
    auto_completed_lesson_dates: "• Termine der absolvierten Lektionen",
    auto_flexible_prorated_billing: "Flexible & anteilige Abrechnung",
    auto_you_can_end_the_current_cycle: "Sie können den aktuellen Kurs für Schüler vorzeitig beenden und basierend auf den tatsächlich besuchten Lektionen abrechnen.",
    auto_there_are_currently_no_student: "Derzeit gibt es keine Schüler mit abgeschlossenen, nicht abgerechneten Lektionen unter dem Kurslimit.",
    auto_prorated_amount: "Vorgeschlagener Betrag",
    auto_attended_lessons: "Besuchte Lektionen:",
    auto_lessons: "Lektionen",
    auto_force_cycle_bill: "Kurs beenden & abrechnen",
    auto_force_end_current_cycle_bill: "Aktuellen Kurs beenden & abrechnen",
    auto_student_name_15: "Schülername:",
    auto_group_16: "Gruppe:",
    auto_attendance_progress: "Anwesenheitsfortschritt:",
    auto_attended_proratemodalitem_le: "${prorateModalItem.lessonDates.length} von ${prorateModalItem.cycleLength} Lektionen besucht",
    auto_completed_lesson_dates_17: "Termine der absolvierten Lektionen:",
    auto_adjust_prorated_due_amount: "Anteiligen fälligen Betrag anpassen:",
    auto_the_suggested_amount_is_calc: "* Der vorgeschlagene Betrag wird automatisch berechnet. Sie können ihn vor der Bestätigung anpassen.",
    auto_mark_as_unpaid_invoice: "Als unbezahlte Rechnung markieren",
    auto_flexible_prorated_payment_p: "Anteilige Zahlung (${prorateModalItem.lessonDates.length}/${prorateModalItem.cycleLength} Lektionen)",
    auto_mark_paid_now: "Sofort als bezahlt markieren",
    auto_profile_work_schedule: "Lehrerprofil",
    auto_personal_information_contact: "Name, E-Mail, Arbeitszeiten & Währung",
    auto_payments_finance: "Zahlungsinformationen",
    auto_financial_information_transfe: "Telefon, InstaPay, Vodafone Cash & Bank",
    auto_messages_communication: "Elternnachrichten Vorlagen",
    auto_automated_parent_communication: "Vorlagen für Hausaufgaben, Anwesenheit & Berichte",
    auto_6_templates: "6 Templates",
    auto_notifications_alerts: "Benachrichtigungen & Alarme",
    auto_reminders_lesson_alerts_dai: "Umfassende Steuerung für Lektionserinnerungen, Zahlungen & Berichte",
    auto_active: "Active",
    auto_disabled: "Disabled",
    auto_appearance_language: "Sprache & Erscheinungsbild",
    auto_personalize_the_interface_expe: "Oberflächensprache & Dunkelmodus",
    auto_motivation_gratitude: "Inspiration & Dankbarkeit",
    auto_daily_inspiration_and_positive: "Tägliche Motivation & Dankbarkeits-Erinnerungen",
    auto_daily: "Daily",
    auto_before_lesson: "Before Lesson",
    auto_random: "Random",
    auto_data_backup: "Sicherung & Daten",
    auto_backup_restore_and_data_manag: "Sicherung herunterladen, wiederherstellen & zurücksetzen",
    auto_about: "About",
    auto_application_information_and_ve: "App-Info, Entwickler & Version",
    auto_select_a_section_to_manage_app: "Wählen Sie einen Bereich zur Verwaltung aus",
    auto_search_settings: "Einstellungen durchsuchen...",
    auto_no_results_found: "Keine Ergebnisse",
    auto_select_a_category: "Wählen Sie eine Kategorie",
    auto_choose_a_category_from_the_sid: "Wählen Sie eine Kategorie aus der Seitenleiste aus, um die Einstellungen anzuzeigen und zu verwalten.",
    auto_language_appearance: "Sprache & Erscheinungsbild",
    auto_choose_application_language_an: "Choose application language and theme mode",
    auto_note_the_selected_language_ap: "Note: The selected language applies to the entire application interface. Parent messages and reports always remain in Arabic.",
    auto_accent_color: "Akzentfarbe",
    auto_select_your_preferred_accent_c: "Wählen Sie die bevorzugte Akzentfarbe für alle Schaltflächen, Symbole, Tabs und Steuerelemente.",
    auto_teacher_profile: "Teacher Profile",
    auto_manage_personal_details_worki: "Manage personal details, working hours & currency",
    auto_edit_profile: "Edit Profile",
    auto_weekly_working_hours: "Weekly Working Hours",
    auto_sat: "Sat",
    auto_sun: "Sun",
    auto_mon: "Mon",
    auto_tue: "Tue",
    auto_wed: "Wed",
    auto_thu: "Thu",
    auto_fri: "Fri",
    auto_reminder_settings: "Reminder Settings",
    auto_in_app_lesson_alerts_within_3: "In-App Lesson Alerts (Within 30 mins)",
    auto_browser_push_notifications: "Browser Push Notifications",
    auto_payment_information: "Payment Information",
    auto_information_used_when_sending: "Information used when sending payment requests to parents",
    auto_direct_electronic_payment_prof: "Direct Electronic Payment Profile",
    auto_copy_payment_info: "Copy Payment Info",
    auto_parent_message_templates: "Parent Message Templates",
    auto_manage_templates_for_homework: "Manage templates for homework, attendance, absence, payment & reports",
    auto_absence: "Absence",
    auto_exam_reports: "Exam Reports",
    auto_lesson_summary: "Lesson Summary",
    auto_message_template_text_arabic: "Message Template Text (Arabic)",
    auto_available_dynamic_placeholders: "Available Dynamic Placeholders:",
    auto_reset_to_default: "Reset to Default",
    auto_save_templates: "Save Templates",
    auto_inspiration_gratitude: "Inspiration & Dankbarkeit",
    auto_teacher_reminders_motivation: "Motivation & Dankbarkeits-Erinnerungen",
    auto_display_settings: "Display Settings",
    auto_frequency: "Frequency",
    auto_once_daily: "Once Daily",
    auto_before_first_lesson: "Before First Lesson",
    auto_randomly_during_day: "Randomly During Day",
    auto_display_method: "Display Method",
    auto_in_app_only_card: "In-App Only (Card)",
    auto_system_notification_only: "System Notification Only",
    auto_in_app_notification: "In-App & Notification",
    auto_message_source: "Message Source",
    auto_all_messages: "All Messages",
    auto_favorites_only: "Favorites Only",
    auto_test_reminder_now: "Test Reminder Now",
    auto_messages: "Messages",
    auto_manage_the_motivational_quotes: "Manage the motivational quotes and prayers. Add your own custom messages or favorite the ones you like.",
    auto_manage_messages: "Manage Messages",
    auto_all: "All",
    auto_favorites: "Favorites",
    auto_add_message: "Add Message",
    auto_restore_default_messages: "Restore Default Messages",
    auto_custom: "Custom",
    auto_are_you_sure: "Are you sure?",
    auto_no_messages_found: "No messages found",
    auto_edit_message: "Edit Message",
    auto_add_new_message: "Add New Message",
    auto_write_your_message: "Write your message...",
    auto_restore_defaults: "Restore Defaults",
    auto_default_messages_will_be_resto: "Default messages will be restored. Your custom messages will not be deleted.",
    auto_restore: "Restore",
    auto_backup_data_management_cente: "Backup & Data Management Center",
    auto_create_full_backups_password: "Create full backups, password encrypt, selectively restore & manage safety checkpoints",
    auto_smart_data_validation_health: "Smart Data Validation & Health Audit",
    auto_inspect_record_consistency_de: "Inspect record consistency, detect potential relationship or financial anomalies, and view data health score.",
    auto_open_data_audit_health_repor: "Open Data Audit & Health Report",
    auto_danger_zone_data_reset: "Danger Zone (Data Reset)",
    auto_sensitive_actions_resetting_d: "Sensitive actions: Resetting data will permanently delete all students, groups, lessons, and payment records.",
    auto_application_details_features: "Application details, features & developer contacts",
    auto_german_teacher_management_syst: "German Teacher Management System",
    auto_description: "Description",
    auto_features: "Features",
    auto_developer: "Developer",
    auto_please_select_at_least_one_cat: "Please select at least one category to export.",
    auto_gathering_and_preparing_backup: "Gathering and preparing backup payload...",
    auto_encrypting_payload_with_passwo: "Encrypting payload with password...",
    auto_backup_file_created_and_down: "✓ Backup file created and downloaded successfully!",
    auto_quick_backup_created_and_sav: "✓ Quick backup created and saved successfully!",
    auto_backup_failed: "❌ Backup failed: ",
    auto_all_data_restored_successful: "✓ All data restored successfully!",
    auto_failed_to_restore_data_plea: "❌ Failed to restore data. Please make sure to choose a valid JSON backup file.",
    auto_incorrect_password_or_corrupte: "Incorrect password or corrupted file.",
    auto_selected_categories_restored: "✓ Selected categories restored successfully with auto restore point!",
    auto_rollback_successful_restore: "✓ Rollback successful! Restored database to previous state.",
    auto_smart_backup_restore_center: "Sicherungs- & Wiederherstellungszentrum",
    auto_professional_data_management: "Professional data management, password encryption, selective restore & 1-click rollback",
    auto_undo_last_restore: "Undo last restore",
    auto_undo_last_restore_18: "Undo Last Restore",
    auto_1_tap_backup: "1-Tap Backup",
    auto_custom_export: "Custom Export",
    auto_custom_restore: "Custom Restore",
    auto_auto_backups: "Auto Backups",
    auto_restore_history: "Restore History",
    auto_instant_1_click_backup: "Instant 1-Click Backup",
    auto_export_and_save_a_complete_bac: "Export and save a complete backup containing all application data (teachers, students, groups, schedule, and financial records) in one simple tap.",
    auto_saving_and_sharing: "Saving and Sharing...",
    auto_tap_to_backup_save_everythin: "Tap to Backup & Save Everything",
    auto_instant_1_click_restore: "Instant 1-Click Restore",
    auto_select_a_backup_json_file_you: "Select a backup JSON file you downloaded previously to restore and replace all system data instantly. An automatic restore point will be saved first for safety.",
    auto_restoring_all_data: "Restoring All Data...",
    auto_choose_file_restore_all: "Choose File & Restore All",
    auto_automatic_data_protection: "Automatic Data Protection",
    auto_before_performing_any_restore: "Before performing any restore action, the app secures your current state. You can revert any restore process back to your previous state instantly by clicking the \"Undo Last Restore\" button above.",
    auto_select_all: "Select All",
    auto_deselect_all: "Deselect All",
    auto_full_backup_selected_100: "Full Backup Selected (100%)",
    auto_partial_selection_selectedc: "Partial Selection (${selectedCategories.length}/${ALL_BACKUP_CATEGORIES.length})",
    auto_full_backup_preview: "Full Backup Preview",
    auto_partial_backup_preview: "Partial Backup Preview",
    auto_payload_details_and_estimated: "Payload details and estimated size before export",
    auto_total_records: "Total Records",
    auto_groups: "Groups",
    auto_estimated_size: "Estimated Size",
    auto_estimated_time: "Estimated Time",
    auto_password_protect_encrypt_bac: "Password Protect & Encrypt Backup File",
    auto_enter_encryption_password: "Enter encryption password...",
    auto_this_password_will_be_required: "This password will be required when restoring this backup file.",
    auto_creating_backup_file: "Creating backup file...",
    auto_download_full_backup_json: "Download Full Backup (JSON)",
    auto_download_partial_backup_sel: "Download Partial Backup (${selectedCategories.length} categories)",
    auto_select_or_drop_backup_file_js: "Select or drop backup file (JSON)",
    auto_supports_standard_and_password: "Supports standard and password encrypted JSON backups",
    auto_browse_json_file: "Browse JSON File",
    auto_this_backup_file_is_password_p: "This backup file is password protected",
    auto_enter_password_to_unlock: "Enter password to unlock...",
    auto_unlock: "Unlock",
    auto_backup_type_analysis_backup: "Backup Type: ${analysis.backupType}",
    auto_verified_structure: "Verified Structure",
    auto_restore_mode: "Restore Mode",
    auto_smart_restore_default: "Smart Restore (Default)",
    auto_detect_duplicates_update_exis: "Detect duplicates, update existing, add missing, maintain links.",
    auto_merge_mode: "Merge Mode",
    auto_keep_current_data_add_importe: "Keep current data, add imported records without deletion.",
    auto_replace_mode: "Replace Mode",
    auto_replace_current_data_with_impo: "Replace current data with imported data for selected categories.",
    auto_categories_to_restore: "Categories to Restore",
    auto_select_all_available: "Select All Available",
    auto_restore_impact_report: "Restore Impact Report",
    auto_records_to_add: "Records to Add",
    auto_records_to_update: "Records to Update",
    auto_duplicates_detected: "Duplicates Detected",
    auto_potential_conflicts: "Potential Conflicts",
    auto_creating_restore_point_apply: "Creating Restore Point & Applying...",
    auto_warning_replace_mode_will_ove: "Warning: Replace Mode will overwrite current data!",
    auto_an_automatic_restore_point_sna: "An automatic Restore Point snapshot will be captured first so you can Undo anytime.",
    auto_confirm_replace_restore: "Confirm Replace & Restore",
    auto_restore_everything: "Restore Everything",
    auto_restore_selected_categories: "Restore Selected Categories (${selectedRestoreCategories.length})",
    auto_automatic_backup_retention_s: "Automatic Backup & Retention Schedule",
    auto_schedule_periodic_background_s: "Schedule periodic background snapshots & set retention limits",
    auto_daily_automatic_backup: "Daily Automatic Backup",
    auto_capture_a_daily_data_snapshot: "Capture a daily data snapshot upon app launch",
    auto_weekly_automatic_backup: "Weekly Automatic Backup",
    auto_capture_a_weekly_snapshot_auto: "Capture a weekly snapshot automatically",
    auto_monthly_automatic_backup: "Monthly Automatic Backup",
    auto_capture_a_monthly_snapshot_for: "Capture a monthly snapshot for record archives",
    auto_backup_retention_policy: "Backup Retention Policy",
    auto_keep_last_cnt: "Keep Last ${cnt}",
    auto_restore_operation_history: "Restore Operation History",
    auto_chronological_audit_log_of_all: "Chronological audit log of all previous restore operations",
    auto_no_restore_history_logged_yet: "No restore history logged yet.",
    auto_student_smart_card: "SCHÜLER SMART CARD",
    auto_active_19: "Aktiv ✓",
    auto_archived: "Archiviert ⚪",
    auto_bearbeiten: "Bearbeiten",
    auto_l_schen: "Löschen",
    auto_call_parent: "Eltern anrufen",
    auto_call_student: "Schüler anrufen",
    auto_overview: "Übersicht",
    auto_attendance_presentcount_l: "Anwesenheit (${presentCount + lateCount + absentCount})",
    auto_grades_homework: "Noten & Aufgaben",
    auto_files_student_documents_len: "Dateien (${student.documents.length})",
    auto_allgemeine_informationen: "ALLGEMEINE INFORMATIONEN",
    auto_import_group_students: "Import Group + Students",
    auto_no_students_yet: "Noch keine Schüler vorhanden",
    auto_add_your_first_student_to_trac: "Füge deinen ersten Schüler hinzu, um Anwesenheit, Lektionen und Zahlungen zu verwalten.",
    auto_parent: "Eltern",
    auto_student_20: "Schüler",
    auto_options: "Optionen",
    auto_view_profile: "Profil ansehen",
    auto_check_attendance: "Anwesenheit prüfen",
    auto_scores_homework: "Noten & Aufgaben",
    auto_payment_history: "Zahlungsverlauf",
    auto_send_whatsapp: "WhatsApp senden",
    auto_call_phone: "Anrufen (Telefon)",
    auto_delete_archive: "Löschen / Archiv",
    auto_no_groups_yet: "Keine Gruppen vorhanden",
    auto_create_your_first_group_to_sta: "Erstelle deine erste Gruppe, um Schüler und Lektionen zu organisieren.",
    auto_view_details: "Details anzeigen",
    auto_online: "Online",
    auto_center: "Zentrum",
    auto_home: "Zuhause",
    auto_private: "Privat",
    auto_in_person: "Vor Ort",
    auto_lesson: "Lesson",
    alert_add_zoom_link: "Bitte fügen Sie den Zoom-Link für die Gruppe hinzu, bevor Sie die Erinnerung senden.",
    alert_no_parent_phone: "Keine Telefonnummer der Eltern registriert. Bitte fügen Sie die Nummer in den Schülerdaten hinzu.",
    alert_finish_lesson_first: "Bitte beenden Sie den Unterricht zuerst, indem Sie auf \"Unterricht beenden und Bericht speichern\" klicken, um den Elternbericht zu öffnen.",
    zoom_saved: "Gespeichert",
    zoom_save_group: "Für Gruppe speichern",
    message_preview: "Nachrichtenvorschau",
    restore_original_text: "Ursprünglichen Text wiederherstellen",
    setup_subtitle: "Deutschlehrer-Assistent",
    setup_description: "Verwalten Sie Schüler, Lektionen, Zahlungen, Hausaufgaben und die Kommunikation mit den Eltern an einem Ort.",
    settings_live_preview: "Live-Vorschau",
    settings_primary_button: "Primärer Button",
    settings_secondary_button: "Sekundär",
    settings_premium_widget: "Premium-Widget",
    settings_adapts_accent: "Passt sich Ihrer Akzentfarbe an",
    student_sitzungen: "SITZUNGEN",
    student_anwesend: "ANWESEND",
    student_paketzyklus: "PAKETZYKLUS",
    student_doc_homework: "Hausaufgaben-Datei",
    student_doc_exam: "Prüfungsdatei",
    student_doc_general: "Schülerdokument",
    student_notizen: "NOTIZEN",}
};
