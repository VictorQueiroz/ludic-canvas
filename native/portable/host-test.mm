#include "macos.hpp"
#include <iostream>

// Observe the native event boundary without adding inspection APIs to the host.
@interface LCRecordingView : LCView
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *events;
@end
@implementation LCRecordingView
- (BOOL)emit:(NSDictionary *)event {
  [self.events addObject:event];
  return YES;
}
@end

static int failures = 0;
static void check(bool passed, const char *message) {
  if (!passed) {
    ++failures;
    std::cerr << "FAIL: " << message << '\n';
  }
}
static NSDictionary *editor(NSString *type, NSString *value) {
  return @{@"key": @1, @"role": @"textbox", @"x": @0, @"y": @0,
           @"width": @240, @"height": @40, @"opacity": @1,
           @"editor": @{@"type": type, @"value": value}};
}
int main() {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    LCDelegate *delegate = [[LCDelegate alloc] init];
    NSWindow *window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 300, 150)
        styleMask:NSWindowStyleMaskTitled backing:NSBackingStoreBuffered defer:NO];
    window.releasedWhenClosed = NO;
    LCRecordingView *view = [[LCRecordingView alloc] initWithFrame:window.contentView.bounds];
    view.events = [NSMutableArray array];
    window.contentView = view;
    window.delegate = delegate;
    [window makeKeyAndOrderFront:nil];

    [view sync:@[editor(@"text", @"controlled value")]];
    [view focusKey:1];
    NSTextField *field = (NSTextField *)view.editors[@1];
    check(field.currentEditor != nil, "text field acquired native focus");
    [(NSTextView *)field.currentEditor setSelectedRange:NSMakeRange(2, 4)];
    [view.events removeAllObjects];
    [view sync:@[editor(@"password", @"controlled value")]];
    field = (NSTextField *)view.editors[@1];
    check([field isKindOfClass:NSSecureTextField.class], "text to password masks mounted editor");
    check([field.stringValue isEqual:@"controlled value"], "password toggle preserves controlled value");
    check(field.currentEditor != nil, "password toggle preserves first responder");
    check(NSEqualRanges([(NSTextView *)field.currentEditor selectedRange], NSMakeRange(2, 4)),
          "password toggle preserves selection");
    check(view.events.count == 0, "controlled replacement emits no user edit or focus event");

    [view sync:@[editor(@"text", @"new")]];
    field = (NSTextField *)view.editors[@1];
    check(![field isKindOfClass:NSSecureTextField.class], "password to text reveals mounted editor");
    check([field.stringValue isEqual:@"new"], "replacement uses latest controlled value");
    check(NSEqualRanges([(NSTextView *)field.currentEditor selectedRange], NSMakeRange(2, 1)),
          "replacement clamps selection to controlled value");

    // Start secure too: cover the inverse transition independently of the first.
    [view sync:@[]];
    [view sync:@[editor(@"password", @"secret")]];
    [view focusKey:0];
    [view sync:@[editor(@"text", @"secret")]];
    check(![view.editors[@1] isKindOfClass:NSSecureTextField.class],
          "initial password field can reveal its value");
    check(window.firstResponder == view, "unfocused replacement does not steal focus");

    for (NSNumber *key in @[@1, @2]) {
      [view sync:@[editor(@"text", @"value"),
                  @{@"key": @2, @"role": @"button", @"label": @"Action"}]];
      [view focusKey:key.integerValue];
      [view.events removeAllObjects];
      [NSNotificationCenter.defaultCenter postNotificationName:NSWindowDidResignKeyNotification object:window];
      check([view.events.lastObject[@"type"] isEqual:@"blur"], "window deactivation emits blur");
      [NSNotificationCenter.defaultCenter postNotificationName:NSWindowDidBecomeKeyNotification object:window];
      NSDictionary *event = view.events.lastObject;
      check([event[@"type"] isEqual:@"focus"] && [event[@"key"] isEqual:key],
            "window reactivation restores editor or button focus event");
    }
    for (NSDictionary *node in @[@{@"key": @2, @"role": @"button", @"disabled": @YES},
                                 @{@"key": @2, @"role": @"button", @"hidden": @YES},
                                 @{@"key": @3, @"role": @"button"}]) {
      [view focusKey:2];
      [NSNotificationCenter.defaultCenter postNotificationName:NSWindowDidResignKeyNotification object:window];
      [view sync:@[node]];
      [NSNotificationCenter.defaultCenter postNotificationName:NSWindowDidBecomeKeyNotification object:window];
      check(view.focusedKey == 0 && view.events.lastObject[@"key"] == NSNull.null,
            "reactivation clears disabled, hidden or removed focus targets");
    }
    [view dispose];
    window.delegate = nil;
    [window close];
    if (!failures)
      std::cout << "AppKit editor replacement and window focus contracts passed.\n";
    return failures ? 1 : 0;
  }
}
