#include "macos.hpp"
#include "engine.hpp"
#include "include/core/SkPixmap.h"
#include "include/core/SkSurface.h"
#include "include/gpu/ganesh/GrBackendSurface.h"
#include "include/gpu/ganesh/GrDirectContext.h"
#include "include/gpu/ganesh/SkSurfaceGanesh.h"
#include "include/gpu/ganesh/mtl/GrMtlBackendContext.h"
#include "include/gpu/ganesh/mtl/GrMtlBackendSurface.h"
#include "include/gpu/ganesh/mtl/GrMtlDirectContext.h"
#include "renderer.hpp"
#import <AppKit/AppKit.h>
#import <ImageIO/ImageIO.h>
#import <Metal/Metal.h>
#import <QuartzCore/CAMetalLayer.h>
#import <QuartzCore/CAShapeLayer.h>
#include <cstring>
#include <iostream>

using namespace lc;
static NSString *ns(const std::string &s) {
  return [[NSString alloc] initWithBytes:s.data() length:s.size() encoding:NSUTF8StringEncoding] ?: @"";
}
static std::string utf8(NSString *s) { return s ? std::string(s.UTF8String ?: "") : std::string(); }
static NSString *role(NSString *value) {
  return (@{
    @"text" : NSAccessibilityStaticTextRole,
    @"button" : NSAccessibilityButtonRole,
    @"switch" : NSAccessibilityCheckBoxRole,
    @"checkbox" : NSAccessibilityCheckBoxRole,
    @"slider" : NSAccessibilitySliderRole,
    @"tab" : NSAccessibilityRadioButtonRole,
    @"tablist" : NSAccessibilityTabGroupRole,
    @"listbox" : NSAccessibilityListRole
  }[value]
              ?: NSAccessibilityGroupRole);
}
@implementation LCElement
- (NSString *)accessibilityRole {
  return role(self.nodeInfo[@"role"]);
}
- (NSString *)accessibilityLabel {
  return self.nodeInfo[@"label"];
}
- (BOOL)isAccessibilityEnabled {
  return ![self.nodeInfo[@"disabled"] boolValue] && ![self.nodeInfo[@"hidden"] boolValue];
}
- (BOOL)isAccessibilityFocused {
  return self.owner.focusedKey == [self.nodeInfo[@"key"] integerValue];
}
- (void)setAccessibilityFocused:(BOOL)value {
  if (value)
    [self.owner focusKey:[self.nodeInfo[@"key"] integerValue]];
}
- (id)accessibilityValue {
  return self.nodeInfo[@"valueText"] ?: self.nodeInfo[@"valueNow"] ?: self.nodeInfo[@"checked"] ?: self.nodeInfo[@"selected"];
}
- (id)accessibilityParent {
  return self.owner.elements[self.nodeInfo[@"parent"]] ?: self.owner;
}
- (NSArray *)accessibilityChildren {
  NSMutableArray *children = [NSMutableArray array];
  for (NSDictionary *n in self.owner.semantics)
    if ([n[@"parent"] isEqual:self.nodeInfo[@"key"]] && ![n[@"hidden"] boolValue]) {
      id element = self.owner.editors[n[@"key"]] ?: self.owner.elements[n[@"key"]];
      if (element)
        [children addObject:element];
    }
  return children;
}
- (NSRect)accessibilityFrame {
  NSDictionary *n = self.nodeInfo;
  NSRect rect = NSMakeRect([n[@"x"] doubleValue], [n[@"y"] doubleValue], [n[@"width"] doubleValue],
                           [n[@"height"] doubleValue]);
  return [self.owner.window convertRectToScreen:[self.owner convertRect:rect toView:nil]];
}
- (BOOL)isAccessibilitySelectorAllowed:(SEL)selector {
  NSString *r = self.nodeInfo[@"role"];
  if (selector == @selector(accessibilityPerformIncrement) ||
      selector == @selector(accessibilityPerformDecrement))
    return [r isEqual:@"slider"];
  if (selector == @selector(accessibilityPerformPress))
    return [@[ @"button", @"checkbox", @"switch", @"tab" ] containsObject:r];
  return [super isAccessibilitySelectorAllowed:selector];
}
- (BOOL)accessibilityPerformPress {
  if (![self isAccessibilityEnabled])
    return NO;
  [self.owner emit:@{@"type" : @"activate", @"key" : self.nodeInfo[@"key"]}];
  return YES;
}
- (BOOL)accessibilityPerformIncrement {
  [self.owner focusKey:[self.nodeInfo[@"key"] integerValue]];
  [self.owner emit:@{@"type" : @"keydown", @"key" : @"ArrowRight", @"code" : @"ArrowRight"}];
  return YES;
}
- (BOOL)accessibilityPerformDecrement {
  [self.owner focusKey:[self.nodeInfo[@"key"] integerValue]];
  [self.owner emit:@{@"type" : @"keydown", @"key" : @"ArrowLeft", @"code" : @"ArrowLeft"}];
  return YES;
}
@end

@implementation LCView
- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.wantsLayer = YES;
    self.layer = [CAMetalLayer layer];
    self.device = MTLCreateSystemDefaultDevice();
    if (!self.device)
      throw std::runtime_error("Metal device unavailable");
    self.queue = [self.device newCommandQueue];
    CAMetalLayer *layer = (CAMetalLayer *)self.layer;
    layer.device = self.device;
    layer.pixelFormat = MTLPixelFormatBGRA8Unorm;
    layer.framebufferOnly = NO;
    layer.opaque = YES;
    GrMtlBackendContext backend;
    backend.fDevice.retain((__bridge GrMTLHandle)self.device);
    backend.fQueue.retain((__bridge GrMTLHandle)self.queue);
    context = GrDirectContexts::MakeMetal(backend);
    if (!context)
      throw std::runtime_error("Cannot create Skia Metal context");
    renderer = std::make_unique<SkiaRenderer>();
    self.elements = [NSMutableDictionary dictionary];
    self.editors = [NSMutableDictionary dictionary];
    self.semantics = @[];
  }
  return self;
}
- (BOOL)isFlipped {
  return YES;
}
- (BOOL)acceptsFirstResponder {
  return YES;
}
- (BOOL)isAccessibilityElement {
  return YES;
}
- (NSString *)accessibilityRole {
  return NSAccessibilityGroupRole;
}
- (NSString *)accessibilityLabel {
  return self.window.title;
}
- (id)accessibilityFocusedUIElement {
  return self.editors[@(self.focusedKey)] ?: self.elements[@(self.focusedKey)] ?: self;
}
- (NSArray *)accessibilityChildren {
  NSMutableArray *children = [NSMutableArray array];
  for (NSDictionary *n in self.semantics)
    if (![n[@"hidden"] boolValue] && !self.elements[n[@"parent"]]) {
      id element = self.editors[n[@"key"]] ?: self.elements[n[@"key"]];
      if (element)
        [children addObject:element];
    }
  return children;
}
- (BOOL)emit:(NSDictionary *)event {
  if (!listener || !engine)
    return NO;
  // The callback may destroy this surface before throwing. The application owns
  // the engine for the whole event dispatch, even after dispose clears our link.
  Engine *eventEngine = engine;
  try {
    auto &rt = eventEngine->runtime();
    NSData *data = [NSJSONSerialization dataWithJSONObject:event options:0 error:nil];
    auto json = rt.global().getPropertyAsObject(rt, "JSON").getPropertyAsFunction(rt, "parse");
    auto value =
        json.call(rt, jsi::String::createFromUtf8(rt, std::string((const char *)data.bytes, data.length)));
    auto callback = listener;
    auto result = callback->call(rt, value);
    rt.drainMicrotasks();
    return result.isBool() && result.getBool();
  } catch (const std::exception &error) {
    eventEngine->errors.emplace_back(error.what());
    std::cerr << error.what() << '\n';
    return NO;
  }
}
- (void)updateTrackingAreas {
  [super updateTrackingAreas];
  if (self.tracking)
    [self removeTrackingArea:self.tracking];
  self.tracking =
      [[NSTrackingArea alloc] initWithRect:self.bounds
                                   options:NSTrackingMouseMoved | NSTrackingMouseEnteredAndExited |
                                           NSTrackingActiveInKeyWindow | NSTrackingInVisibleRect
                                     owner:self
                                  userInfo:nil];
  [self addTrackingArea:self.tracking];
}
- (NSDictionary *)pointer:(NSEvent *)event type:(NSString *)type {
  NSPoint p = [self convertPoint:event.locationInWindow fromView:nil];
  return @{
    @"type" : type,
    @"x" : @(p.x),
    @"y" : @(p.y),
    @"buttons" : @(NSEvent.pressedMouseButtons),
    @"button" : @(event.buttonNumber),
    @"pointerId" : @1,
    @"pointerType" : @"mouse"
  };
}
- (void)mouseDown:(NSEvent *)e {
  [self emit:[self pointer:e type:@"pointerdown"]];
}
- (void)mouseUp:(NSEvent *)e {
  [self emit:[self pointer:e type:@"pointerup"]];
}
- (void)mouseDragged:(NSEvent *)e {
  [self emit:[self pointer:e type:@"pointermove"]];
}
- (void)mouseMoved:(NSEvent *)e {
  [self emit:[self pointer:e type:@"pointermove"]];
}
- (void)mouseExited:(NSEvent *)e {
  [self emit:@{@"type" : @"leave"}];
}
- (void)scrollWheel:(NSEvent *)e {
  NSPoint p = [self convertPoint:e.locationInWindow fromView:nil];
  [self emit:@{
    @"type" : @"wheel",
    @"x" : @(p.x),
    @"y" : @(p.y),
    @"deltaX" : @(-e.scrollingDeltaX),
    @"deltaY" : @(-e.scrollingDeltaY),
    @"deltaZ" : @0,
    @"deltaMode" : @(e.hasPreciseScrollingDeltas ? 0 : 1),
    @"shiftKey" : @((e.modifierFlags & NSEventModifierFlagShift) != 0),
    @"ctrlKey" : @((e.modifierFlags & NSEventModifierFlagControl) != 0),
    @"altKey" : @((e.modifierFlags & NSEventModifierFlagOption) != 0),
    @"metaKey" : @((e.modifierFlags & NSEventModifierFlagCommand) != 0)
  }];
}
- (NSString *)key:(NSEvent *)e {
  switch (e.keyCode) {
  case 48:
    return @"Tab";
  case 53:
    return @"Escape";
  case 36:
  case 76:
    return @"Enter";
  case 49:
    return @" ";
  case 123:
    return @"ArrowLeft";
  case 124:
    return @"ArrowRight";
  case 125:
    return @"ArrowDown";
  case 126:
    return @"ArrowUp";
  default:
    return e.charactersIgnoringModifiers ?: @"";
  }
}
- (BOOL)sendKey:(NSEvent *)e {
  NSString *key = [self key:e];
  return [self emit:@{
    @"type" : @"keydown",
    @"key" : key,
    @"code" : key,
    @"repeat" : @(e.isARepeat),
    @"shiftKey" : @((e.modifierFlags & NSEventModifierFlagShift) != 0),
    @"ctrlKey" : @((e.modifierFlags & NSEventModifierFlagControl) != 0),
    @"altKey" : @((e.modifierFlags & NSEventModifierFlagOption) != 0),
    @"metaKey" : @((e.modifierFlags & NSEventModifierFlagCommand) != 0)
  }];
}
- (void)keyDown:(NSEvent *)e {
  if (![self sendKey:e])
    [super keyDown:e];
}
- (BOOL)focusKey:(NSInteger)key {
  NSView *editor = self.editors[@(key)];
  if (editor.hidden)
    return NO;
  if (editor) {
    if ([editor isKindOfClass:NSScrollView.class])
      [self.window makeFirstResponder:((NSScrollView *)editor).documentView];
    else
      [self.window makeFirstResponder:editor];
  } else
    [self.window makeFirstResponder:self];
  self.focusedKey = key;
  [self emit:@{@"type" : @"focus", @"key" : key ? @(key) : NSNull.null}];
  NSAccessibilityPostNotification(editor ?: self.elements[@(key)] ?: self,NSAccessibilityFocusedUIElementChangedNotification);
  return YES;
}
- (void)controlTextDidBeginEditing:(NSNotification *)notification {
  if (self.syncing)
    return;
  NSInteger key = [((NSControl *)notification.object).identifier integerValue];
  self.focusedKey = key;
  [self emit:@{@"type" : @"focus", @"key" : @(key)}];
}
- (void)controlTextDidChange:(NSNotification *)notification {
  [self editChanged:notification.object];
}
- (void)textDidChange:(NSNotification *)notification {
  [self editChanged:notification.object];
}
- (void)textDidBeginEditing:(NSNotification *)notification {
  if (self.syncing)
    return;
  NSInteger key = [((NSTextView *)notification.object).identifier integerValue];
  self.focusedKey = key;
  [self emit:@{@"type" : @"focus", @"key" : @(key)}];
}
- (void)editChanged:(id)sender {
  if (self.syncing)
    return;
  NSInteger key = [[sender identifier] integerValue];
  NSString *value;
  NSTextView *text;
  if ([sender isKindOfClass:NSTextField.class]) {
    value = [sender stringValue];
    text = (NSTextView *)[sender currentEditor];
  } else {
    text = sender;
    value = text.string;
  }
  [self emit:@{
    @"type" : @"edit",
    @"key" : @(key),
    @"value" : value ?: @"",
    @"composing" : @(text.hasMarkedText)
  }];
}
- (BOOL)control:(NSControl *)control textView:(NSTextView *)text doCommandBySelector:(SEL)selector {
  if (text.hasMarkedText)
    return NO;
  if (selector == @selector(insertTab:) || selector == @selector(insertBacktab:) ||
      selector == @selector(cancelOperation:) || selector == @selector(insertNewline:))
    return [self sendKey:NSApp.currentEvent];
  return NO;
}
- (BOOL)textView:(NSTextView *)text doCommandBySelector:(SEL)selector {
  if (text.hasMarkedText)
    return NO;
  if (selector == @selector(insertTab:) || selector == @selector(insertBacktab:) ||
      selector == @selector(cancelOperation:))
    return [self sendKey:NSApp.currentEvent];
  return NO;
}
- (BOOL)textView:(NSTextView *)text
    shouldChangeTextInRange:(NSRange)range
          replacementString:(NSString *)replacement {
  if (text.hasMarkedText)
    return YES;
  NSNumber *key = @([text.identifier integerValue] ?: self.focusedKey);
  NSDictionary *description = nil;
  for (NSDictionary *n in self.semantics)
    if ([n[@"key"] isEqual:key]) {
      description = n[@"editor"];
      break;
    }
  NSNumber *max = description[@"maxLength"];
  return !max || text.string.length - range.length + replacement.length <= max.unsignedIntegerValue;
}
- (void)sync:(NSArray *)nodes {
  self.syncing = YES;
  @try {
    self.semantics = nodes;
    NSMutableSet *live = [NSMutableSet set];
    for (NSDictionary *n in nodes) {
      NSNumber *key = n[@"key"];
      [live addObject:key];
      NSDictionary *description = n[@"editor"];
      if (description) {
        [self.elements removeObjectForKey:key];
        NSView *native = self.editors[key];
        BOOL multiline = [description[@"multiline"] boolValue];
        BOOL secure = !multiline && [description[@"type"] isEqual:@"password"];
        BOOL restoreFocus = NO;
        NSRange selection = NSMakeRange(0, 0);
        if (native &&
            (multiline != [native isKindOfClass:NSScrollView.class] ||
             (!multiline && secure != [native isKindOfClass:NSSecureTextField.class]))) {
          NSTextView *text = [native isKindOfClass:NSScrollView.class]
                                ? (NSTextView *)((NSScrollView *)native).documentView
                                : (NSTextView *)((NSTextField *)native).currentEditor;
          restoreFocus = text && self.window.firstResponder == text;
          if (restoreFocus)
            selection = text.selectedRange;
          // Finish the old editor without emitting a user edit or focus change.
          // The replacement is synchronized from the controlled description below.
          if ([native isKindOfClass:NSTextField.class])
            ((NSTextField *)native).delegate = nil;
          else
            text.delegate = nil;
          if (restoreFocus)
            [self.window makeFirstResponder:self];
          [native removeFromSuperview];
          [self.editors removeObjectForKey:key];
          native = nil;
        }
        if (!native) {
          if (multiline) {
            NSScrollView *scroll = [[NSScrollView alloc] initWithFrame:NSZeroRect];
            scroll.drawsBackground = NO;
            scroll.hasVerticalScroller = YES;
            NSTextView *text = [[NSTextView alloc] initWithFrame:NSZeroRect];
            text.drawsBackground = NO;
            text.delegate = self;
            text.allowsUndo = YES;
            text.identifier = key.stringValue;
            text.verticallyResizable = YES;
            text.autoresizingMask = NSViewWidthSizable;
            scroll.documentView = text;
            native = scroll;
          } else {
            NSTextField *field = secure
                                     ? [[NSSecureTextField alloc] initWithFrame:NSZeroRect]
                                     : [[NSTextField alloc] initWithFrame:NSZeroRect];
            field.bordered = NO;
            field.bezeled = NO;
            field.drawsBackground = NO;
            field.delegate = self;
            field.identifier = key.stringValue;
            field.focusRingType = NSFocusRingTypeNone;
            native = field;
          }
          self.editors[key] = native;
          [self addSubview:native];
        }
        const CGFloat padding =
            description[@"textStyle"][@"padding"] ? [description[@"textStyle"][@"padding"] doubleValue] : 10;
        native.frame = NSMakeRect([n[@"x"] doubleValue] + padding, [n[@"y"] doubleValue] + padding,
                                  MAX(0, [n[@"width"] doubleValue] - padding * 2),
                                  MAX(0, [n[@"height"] doubleValue] - padding * 2));
        native.hidden = [n[@"hidden"] boolValue];
        native.alphaValue = [n[@"opacity"] doubleValue];
        // Clip native editors to the same rectangular ancestor intersection as canvas content.
        NSDictionary *clip = n[@"clip"];
        native.wantsLayer = YES;
        if (clip) {
          NSRect intersection = NSIntersectionRect(
              native.frame, NSMakeRect([clip[@"x"] doubleValue], [clip[@"y"] doubleValue],
                                       [clip[@"w"] doubleValue], [clip[@"h"] doubleValue]));
          CAShapeLayer *mask = [CAShapeLayer layer];
          CGPathRef path = CGPathCreateWithRect(CGRectMake(intersection.origin.x - native.frame.origin.x,
                                                           intersection.origin.y - native.frame.origin.y,
                                                           intersection.size.width, intersection.size.height),
                                                nullptr);
          mask.path = path;
          native.layer.mask = mask;
          CGPathRelease(path);
        } else
          native.layer.mask = nil;
        NSDictionary *style = description[@"textStyle"] ?: @{};
        CGFloat fontSize = style[@"fontSize"] ? [style[@"fontSize"] doubleValue] : 16;
        NSFont *font = [NSFont fontWithName:style[@"fontFamily"] ?: @"" size:fontSize]
                           ?: [NSFont systemFontOfSize:fontSize];
        NSArray *rgba = description[@"foreground"];
        CGFloat alpha = rgba.count == 4 ? [rgba[3] doubleValue] : 1;
        NSColor *foreground = rgba.count == 4
                                  ? [NSColor colorWithSRGBRed:alpha ? [rgba[0] doubleValue] / alpha : 0
                                                        green:alpha ? [rgba[1] doubleValue] / alpha : 0
                                                         blue:alpha ? [rgba[2] doubleValue] / alpha : 0
                                                        alpha:alpha]
                                  : NSColor.whiteColor;
        NSTextAlignment alignment = [style[@"textAlign"] isEqual:@"center"]  ? NSTextAlignmentCenter
                                    : [style[@"textAlign"] isEqual:@"right"] ? NSTextAlignmentRight
                                                                             : NSTextAlignmentLeft;
        NSString *value = description[@"value"] ?: @"";
        BOOL enabled = ![n[@"disabled"] boolValue] && !native.hidden;
        if ([native isKindOfClass:NSTextField.class]) {
          NSTextField *field = (NSTextField *)native;
          field.font = font;
          field.textColor = foreground;
          field.alignment = alignment;
          field.enabled = enabled;
          field.editable = enabled && ![description[@"readOnly"] boolValue];
          field.selectable = enabled;
          field.placeholderString = description[@"placeholder"];
          field.accessibilityLabel = n[@"label"];
          NSTextView *text = (NSTextView *)field.currentEditor;
          if (![field.stringValue isEqual:value] && !text.hasMarkedText) {
            NSRange selection = text.selectedRange;
            field.stringValue = value;
            if (text)
              [text setSelectedRange:NSMakeRange(MIN(selection.location, value.length),
                                                 MIN(selection.length,
                                                     value.length - MIN(selection.location, value.length)))];
          }
        } else {
          NSTextView *text = (NSTextView *)((NSScrollView *)native).documentView;
          text.font = font;
          text.textColor = foreground;
          text.alignment = alignment;
          text.automaticSpellingCorrectionEnabled = [description[@"spellCheck"] boolValue];
          text.continuousSpellCheckingEnabled = [description[@"spellCheck"] boolValue];
          text.editable = enabled && ![description[@"readOnly"] boolValue];
          text.selectable = enabled;
          text.accessibilityLabel = n[@"label"];
          text.textContainer.containerSize = NSMakeSize(native.bounds.size.width, CGFLOAT_MAX);
          text.textContainer.widthTracksTextView = YES;
          if (![text.string isEqual:value] && !text.hasMarkedText) {
            NSRange selection = text.selectedRange;
            text.string = value;
            text.selectedRange =
                NSMakeRange(MIN(selection.location, value.length),
                            MIN(selection.length, value.length - MIN(selection.location, value.length)));
          }
        }
        if (restoreFocus && enabled) {
          NSView *responder = [native isKindOfClass:NSScrollView.class]
                                  ? ((NSScrollView *)native).documentView
                                  : native;
          [self.window makeFirstResponder:responder];
          NSTextView *text = [native isKindOfClass:NSScrollView.class]
                                ? (NSTextView *)responder
                                : (NSTextView *)((NSTextField *)native).currentEditor;
          const NSUInteger start = MIN(selection.location, value.length);
          text.selectedRange = NSMakeRange(start, MIN(selection.length, value.length - start));
        }
      } else {
        LCElement *element = self.elements[key];
        if (!element) {
          element = [[LCElement alloc] init];
          element.owner = self;
          self.elements[key] = element;
        }
        element.nodeInfo = n;
      }
    }
    for (NSNumber *key in self.elements.allKeys)
      if (![live containsObject:key])
        [self.elements removeObjectForKey:key];
    for (NSNumber *key in self.editors.allKeys)
      if (![live containsObject:key]) {
        [self.editors[key] removeFromSuperview];
        [self.editors removeObjectForKey:key];
      }
  } @finally {
    self.syncing = NO;
  }
}
- (void)present {
  if (!context || self.bounds.size.width <= 0 || self.bounds.size.height <= 0 || logicalWidth <= 0 ||
      logicalHeight <= 0)
    return;
  CAMetalLayer *layer = (CAMetalLayer *)self.layer;
  CGFloat scale = self.window.backingScaleFactor ?: 1;
  layer.contentsScale = scale;
  layer.drawableSize = CGSizeMake(self.bounds.size.width * scale, self.bounds.size.height * scale);
  id<CAMetalDrawable> drawable = [layer nextDrawable];
  if (!drawable)
    return;
  GrMtlTextureInfo texture;
  texture.fTexture.retain((__bridge GrMTLHandle)drawable.texture);
  auto target =
      GrBackendRenderTargets::MakeMtl((int)drawable.texture.width, (int)drawable.texture.height, texture);
  auto surface = SkSurfaces::WrapBackendRenderTarget(context.get(), target, kTopLeft_GrSurfaceOrigin,
                                                     kBGRA_8888_SkColorType, nullptr, nullptr);
  if (!surface)
    throw std::runtime_error("Cannot wrap Metal drawable");
  auto *canvas = surface->getCanvas();
  canvas->clear(SkColorSetRGB(16, 22, 32));
  canvas->scale(drawable.texture.width / logicalWidth, drawable.texture.height / logicalHeight);
  renderer->draw(canvas, commands, resources, images, frameTime);
  context->flushAndSubmit(surface.get());
  id<MTLCommandBuffer> buffer = [self.queue commandBuffer];
  [buffer presentDrawable:drawable];
  [buffer commit];
}
- (void)dispose {
  listener.reset();
  [self sync:@[]];
  images.clear();
  commands.clear();
  resources.clear();
  if (context) {
    context->flushAndSubmit();
    context.reset();
  }
  renderer.reset();
  engine = nullptr;
}
@end

@implementation LCDelegate
- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
  return YES;
}
- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
  if (!self.terminating) {
    self.terminating = YES;
    for (NSWindow *window in [sender.windows copy]) {
      LCView *view = window.contentView;
      if ([view isKindOfClass:LCView.class])
        [view emit:@{@"type" : @"close"}];
    }
  }
  [sender stop:nil];
  return NSTerminateCancel;
}
- (BOOL)windowShouldClose:(NSWindow *)window {
  LCView *v = window.contentView;
  if ([v isKindOfClass:LCView.class] && v->listener) {
    [v emit:@{@"type" : @"close"}];
    return NO;
  }
  return YES;
}
- (void)windowDidResignKey:(NSNotification *)notification {
  LCView *view = ((NSWindow *)notification.object).contentView;
  if ([view isKindOfClass:LCView.class])
    [view emit:@{@"type" : @"blur"}];
}
- (void)windowDidBecomeKey:(NSNotification *)notification {
  LCView *view = ((NSWindow *)notification.object).contentView;
  if (![view isKindOfClass:LCView.class])
    return;
  // AppKit keeps its first responder across deactivation; portable input clears
  // focus on blur. Restore only a still-visible, enabled semantic target.
  NSNumber *key = nil;
  for (NSDictionary *node in view.semantics)
    if ([node[@"key"] integerValue] == view.focusedKey &&
        ![node[@"hidden"] boolValue] && ![node[@"disabled"] boolValue]) {
      key = node[@"key"];
      break;
    }
  view.focusedKey = key.integerValue;
  [view emit:@{@"type" : @"focus", @"key" : key ?: NSNull.null}];
}
@end

static sk_sp<SkImage> loadImage(const std::filesystem::path &path) {
  auto bytes = readFile(path);
  if (bytes.size() > 32 * 1024 * 1024)
    throw std::runtime_error("Image exceeds 32 MiB input limit");
  NSData *data = [NSData dataWithBytes:bytes.data() length:bytes.size()];
  CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)data, nullptr);
  if (!source)
    throw std::runtime_error("Cannot decode image");
  CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, nullptr);
  CFRelease(source);
  if (!image)
    throw std::runtime_error("Cannot decode image");
  const auto w = CGImageGetWidth(image), h = CGImageGetHeight(image);
  if (!w || !h || w > 8192 || h > 8192 || w * h > 16 * 1024 * 1024) {
    CGImageRelease(image);
    throw std::runtime_error("Image exceeds native resource limit");
  }
  std::vector<uint8_t> pixels(w * h * 4);
  CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
  CGContextRef bitmap =
      CGBitmapContextCreate(pixels.data(), w, h, 8, w * 4, space,
                            CGBitmapInfo(kCGImageAlphaPremultipliedLast) | kCGBitmapByteOrder32Big);
  CGColorSpaceRelease(space);
  if (!bitmap) {
    CGImageRelease(image);
    throw std::runtime_error("Cannot allocate image decode buffer");
  }
  CGContextDrawImage(bitmap, CGRectMake(0, 0, w, h), image);
  CGContextRelease(bitmap);
  CGImageRelease(image);
  return SkImages::RasterFromPixmapCopy(
      SkPixmap(SkImageInfo::Make(w, h, kRGBA_8888_SkColorType, kPremul_SkAlphaType), pixels.data(), w * 4));
}

#ifndef LUDIC_HOST_TEST
int main(int argc, const char **argv) {
  @autoreleasepool {
    try {
      [NSApplication sharedApplication];
      [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
      Engine engine;
      LCDelegate *delegate = [[LCDelegate alloc] init];
      delegate.engine = &engine;
      NSApp.delegate = delegate;
      NSMutableDictionary<NSNumber *, LCView *> *surfaces = [NSMutableDictionary dictionary];
      NSMutableArray<NSWindow *> *windows = [NSMutableArray array];
      const bool test = argc > 2 && std::string(argv[2]) == "--test";
      auto finish = [&] {
        // JSI exceptions and callbacks must die while their runtime is alive.
        try {
          engine.shutdown();
        } catch (const std::exception &error) {
          engine.errors.emplace_back(error.what());
          std::cerr << error.what() << '\n';
        }
        for (LCView *surface in surfaces.allValues)
          [surface dispose];
        for (NSWindow *window in windows) {
          window.delegate = nil;
          window.contentView = nil;
          [window close];
        }
        [surfaces removeAllObjects];
        [windows removeAllObjects];
        NSApp.delegate = nil;
        if (test)
          std::cout << "Native host cleanup: layouts=" << engine.layoutCount()
                    << " nodes=" << engine.nodeCount() << " surfaces=" << surfaces.count << std::endl;
      };
      try {
        const auto bundle =
            argc > 1 ? std::filesystem::path(argv[1])
                     : std::filesystem::path(NSBundle.mainBundle.resourcePath.UTF8String) / "app.hbc";
        const auto assets = bundle.parent_path();
        auto &rt = engine.runtime();
        rt.global().getPropertyAsObject(rt, "__ludicNative").setProperty(rt, "version", 1);
        uint32_t nextSurface = 0;
        auto view = [&](const jsi::Value &id) -> LCView * {
          auto v = surfaces[@(id.asNumber())];
          if (!v)
            throw std::runtime_error("Surface destroyed or unknown");
          return v;
        };
        engine.bind("readAsset", 1, [&](auto &rt, const auto &, const auto *args, size_t) {
          const auto bytes = readFile(assetPath(assets, args[0].asString(rt).utf8(rt)));
          if (bytes.size() > 32 * 1024 * 1024)
            throw std::runtime_error("Asset exceeds 32 MiB input limit");
          return jsi::Value(jsi::String::createFromUtf8(rt, bytes));
        });
        engine.bind("createSurface", 3, [&](auto &rt, const auto &, const auto *args, size_t) {
          double w = args[1].asNumber(), h = args[2].asNumber();
          if (!std::isfinite(w) || !std::isfinite(h) || w <= 0 || h <= 0 || w > 8192 || h > 8192)
            throw std::runtime_error("Invalid window dimensions");
          NSWindow *window = [[NSWindow alloc]
              initWithContentRect:NSMakeRect(0, 0, w, h)
                        styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                                  NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
                          backing:NSBackingStoreBuffered
                            defer:NO];
          window.title = ns(args[0].asString(rt).utf8(rt));
          window.delegate = delegate;
          window.releasedWhenClosed = NO;
          LCView *surface = [[LCView alloc] initWithFrame:NSMakeRect(0, 0, w, h)];
          surface->engine = &engine;
          surface.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
          window.contentView = surface;
          window.acceptsMouseMovedEvents = YES;
          const auto id = ++nextSurface;
          surfaces[@(id)] = surface;
          [windows addObject:window];
          [window center];
          [window makeKeyAndOrderFront:nil];
          return jsi::Value(double(id));
        });
        engine.bind("size", 1, [&](auto &rt, const auto &, const auto *args, size_t) {
          auto v = view(args[0]);
          jsi::Object size(rt);
          size.setProperty(rt, "width", v.bounds.size.width);
          size.setProperty(rt, "height", v.bounds.size.height);
          size.setProperty(rt, "scale", v.window.backingScaleFactor ?: 1);
          return jsi::Value(std::move(size));
        });
        engine.bind("listen", 2, [&](auto &rt, const auto &, const auto *args, size_t) {
          auto v = view(args[0]);
          if (args[1].isNull())
            v->listener.reset();
          else
            v->listener = std::make_shared<jsi::Function>(args[1].asObject(rt).asFunction(rt));
          return jsi::Value::undefined();
        });
        engine.bind("semantics", 2, [&](auto &rt, const auto &, const auto *args, size_t) {
          auto json = args[1].asString(rt).utf8(rt);
          NSData *data = [NSData dataWithBytes:json.data() length:json.size()];
          NSArray *nodes = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
          if (![nodes isKindOfClass:NSArray.class])
            throw std::runtime_error("Invalid semantic tree");
          [view(args[0]) sync:nodes];
          return jsi::Value::undefined();
        });
        engine.bind("focus", 2, [&](auto &, const auto &, const auto *args, size_t) {
          return jsi::Value(bool([view(args[0]) focusKey:args[1].asNumber()]));
        });
        engine.bind("selectEditor", 2, [&](auto &, const auto &, const auto *args, size_t) {
          auto v = view(args[0]);
          auto key = args[1].asNumber();
          [v focusKey:key];
          NSView *editor = v.editors[@(key)];
          if ([editor isKindOfClass:NSTextField.class])
            [(NSTextField *)editor selectText:nil];
          else if ([editor isKindOfClass:NSScrollView.class])
            [((NSScrollView *)editor).documentView selectAll:nil];
          return jsi::Value(editor != nil);
        });
        engine.bind("cursor", 2, [&](auto &rt, const auto &, const auto *args, size_t) {
          view(args[0]);
          const auto name = args[1].asString(rt).utf8(rt);
          [(name == "pointer" ? NSCursor.pointingHandCursor
            : name == "text"  ? NSCursor.IBeamCursor
                              : NSCursor.arrowCursor) set];
          return jsi::Value::undefined();
        });
        engine.bind("announce", 2, [&](auto &rt, const auto &, const auto *args, size_t) {
          NSAccessibilityPostNotificationWithUserInfo(
              view(args[0]), NSAccessibilityAnnouncementRequestedNotification, @{
                NSAccessibilityAnnouncementKey : ns(args[1].asString(rt).utf8(rt)),
                NSAccessibilityPriorityKey : @(NSAccessibilityPriorityMedium)
              });
          return jsi::Value::undefined();
        });
        engine.bind("loadImage", 2, [&](auto &rt, const auto &, const auto *args, size_t) {
          auto v = view(args[0]);
          auto image = loadImage(assetPath(assets, args[1].asString(rt).utf8(rt)));
          if (!image)
            throw std::runtime_error("Cannot create image");
          const auto id = ++v->nextImage;
          v->images[id] = image;
          jsi::Object result(rt);
          result.setProperty(rt, "handle", double(id));
          result.setProperty(rt, "width", image->width());
          result.setProperty(rt, "height", image->height());
          result.setProperty(rt, "bytes", double(image->width()) * image->height() * 4);
          return jsi::Value(std::move(result));
        });
        engine.bind("releaseImage", 2, [&](auto &, const auto &, const auto *args, size_t) {
          view(args[0])->images.erase(args[1].asNumber());
          return jsi::Value::undefined();
        });
        engine.bind("submit", 6, [&](auto &rt, const auto &, const auto *args, size_t) {
          auto v = view(args[0]);
          auto array = args[1].asObject(rt);
          auto buffer = array.getPropertyAsObject(rt, "buffer").getArrayBuffer(rt);
          const size_t offset = array.getProperty(rt, "byteOffset").asNumber(),
                       bytes = array.getProperty(rt, "byteLength").asNumber();
          if (offset > buffer.size(rt) || bytes > buffer.size(rt) - offset || bytes % (24 * sizeof(float)) ||
              bytes > 64 * 1024 * 1024)
            throw std::runtime_error("Invalid draw buffer");
          v->commands.resize(bytes / sizeof(float));
          std::memcpy(v->commands.data(), buffer.data(rt) + offset, bytes);
          auto resources = args[2].asObject(rt).asArray(rt);
          v->resources.clear();
          for (size_t i = 0; i < resources.size(rt); ++i)
            v->resources.push_back(resources.getValueAtIndex(rt, i).asNumber());
          v->logicalWidth = args[3].asNumber();
          v->logicalHeight = args[4].asNumber();
          v->frameTime = args[5].asNumber();
          [v present];
          return jsi::Value::undefined();
        });
        engine.bind("destroySurface", 1, [&](auto &, const auto &, const auto *args, size_t) {
          auto v = view(args[0]);
          NSWindow *window = v.window;
          [v dispose];
          [window close];
          window.contentView = nil;
          [windows removeObject:window];
          [surfaces removeObjectForKey:@(args[0].asNumber())];
          return jsi::Value::undefined();
        });
        // Native test hooks are only installed for explicit qualification runs.
        if (test)
          engine.bind("inspectNative", 0, [&](auto &rt, const auto &, const auto *, size_t) {
            jsi::Object info(rt);
            info.setProperty(rt, "layouts", double(engine.layoutCount()));
            info.setProperty(rt, "nodes", double(engine.nodeCount()));
            info.setProperty(rt, "surfaces", double(surfaces.count));
            return jsi::Value(std::move(info));
          });
        engine.load(bundle);
        NSMenu *menu = [[NSMenu alloc] init];
        NSMenuItem *item = [[NSMenuItem alloc] init];
        [menu addItem:item];
        NSMenu *appMenu = [[NSMenu alloc] init];
        [appMenu addItemWithTitle:@"Quit Ludic Native" action:@selector(terminate:) keyEquivalent:@"q"];
        item.submenu = appMenu;
        NSApp.mainMenu = menu;
        NSMenuItem *editItem = [[NSMenuItem alloc] init];
        [menu addItem:editItem];
        NSMenu *edit = [[NSMenu alloc] initWithTitle:@"Edit"];
        editItem.submenu = edit;
        [edit addItemWithTitle:@"Undo" action:@selector(undo:) keyEquivalent:@"z"];
        NSMenuItem *redo = [edit addItemWithTitle:@"Redo" action:@selector(redo:) keyEquivalent:@"z"];
        redo.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagShift;
        [edit addItem:NSMenuItem.separatorItem];
        [edit addItemWithTitle:@"Cut" action:@selector(cut:) keyEquivalent:@"x"];
        [edit addItemWithTitle:@"Copy" action:@selector(copy:) keyEquivalent:@"c"];
        [edit addItemWithTitle:@"Paste" action:@selector(paste:) keyEquivalent:@"v"];
        [edit addItemWithTitle:@"Select All" action:@selector(selectAll:) keyEquivalent:@"a"];
        __block bool stopped = false;
        Engine *pumpingEngine = &engine;
        NSTimer *timer =
            [NSTimer scheduledTimerWithTimeInterval:1.0 / 120
                                            repeats:YES
                                              block:^(NSTimer *) {
                                                if (stopped)
                                                  return;
                                                try {
                                                  pumpingEngine->pump();
                                                } catch (const std::exception &error) {
                                                  pumpingEngine->errors.emplace_back(error.what());
                                                  std::cerr << error.what() << '\n';
                                                  stopped = true;
                                                  [NSApp stop:nil];
                                                }
                                              }];
        [NSApp activateIgnoringOtherApps:YES];
        [NSApp run];
        stopped = true;
        [timer invalidate];
        if (test) {
          std::cout << "Native app teardown: layouts=" << engine.layoutCount()
                    << " nodes=" << engine.nodeCount() << " surfaces=" << surfaces.count << std::endl;
          if (engine.layoutCount() || engine.nodeCount() || surfaces.count)
            engine.errors.emplace_back("Native root was not released before runtime shutdown");
        }
        finish();
        return engine.errors.empty() ? 0 : 1;
      } catch (const std::exception &error) {
        // Catch before Engine unwinds: JSError retains a runtime-owned JS value.
        std::cerr << error.what() << '\n';
        finish();
        return 1;
      }
    } catch (const std::exception &error) {
      std::cerr << error.what() << '\n';
      return 1;
    }
  }
}

#endif
