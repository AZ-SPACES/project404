package com.aza.backend.security.filter;

import com.aza.backend.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Architecture guard for the API-key surface.
 *
 * MerchantApiKeyFilter authenticates a {@code Merchant} principal on every path in its
 * ACTIVATED_PREFIXES list. A handler on such a path that declares
 * {@code @AuthenticationPrincipal User} receives null and NPEs — an API-key call gets a
 * 500 instead of working. That bug shipped twice (refund/expire, then
 * customers/{id}/sessions and disputes/{id}/respond); this test makes a third time
 * impossible: adding a prefix to the filter without converting every handler under it
 * fails the build with the exact offending method named.
 */
class ApiKeySurfaceConversionTest {

    @Test
    void everyHandlerOnAnActivatedPath_acceptsBothPrincipalTypes() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));

        List<String> violations = new ArrayList<>();
        int activatedHandlers = 0;

        for (BeanDefinition bd : scanner.findCandidateComponents("com.aza.backend")) {
            Class<?> controller = Class.forName(bd.getBeanClassName());
            String basePath = basePath(controller);

            for (Method method : controller.getDeclaredMethods()) {
                RequestMapping mapping =
                        AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                if (mapping == null) continue;

                String[] methodPaths = mapping.path().length > 0 ? mapping.path() : new String[]{""};
                for (String methodPath : methodPaths) {
                    String fullPath = basePath + methodPath;
                    if (!MerchantApiKeyFilter.isActivatedPath(fullPath)) continue;
                    activatedHandlers++;

                    for (Parameter p : method.getParameters()) {
                        if (p.isAnnotationPresent(AuthenticationPrincipal.class)
                                && User.class.isAssignableFrom(p.getType())) {
                            violations.add(controller.getSimpleName() + "." + method.getName()
                                    + " (" + fullPath + ") declares @AuthenticationPrincipal User");
                        }
                    }
                }
            }
        }

        // If the scan sees too few handlers, the test is not protecting anything —
        // fail loudly rather than false-pass on a broken classpath scan.
        assertTrue(activatedHandlers >= 25,
                "Expected the scan to find the activated merchant API surface but saw only "
                        + activatedHandlers + " handlers — the scanner is misconfigured");

        assertTrue(violations.isEmpty(),
                "Handlers on API-key-activated paths must declare @AuthenticationPrincipal Object "
                        + "and resolve via resolveMerchantId/PrincipalResolver, or API-key calls 500:\n  "
                        + String.join("\n  ", violations));
    }

    private static String basePath(Class<?> controller) {
        RequestMapping rm = AnnotatedElementUtils.findMergedAnnotation(controller, RequestMapping.class);
        if (rm == null || rm.path().length == 0) return "";
        return rm.path()[0];
    }
}
